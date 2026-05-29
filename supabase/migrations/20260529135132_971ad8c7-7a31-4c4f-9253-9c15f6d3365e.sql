
-- =========================================================================
-- INVENTORY UNIT OWNERSHIP LAYER + FINANCE LINK FIX
-- =========================================================================

-- 1) ENUM for inventory unit status
DO $$ BEGIN
  CREATE TYPE public.inventory_unit_status AS ENUM ('active','maintenance','retired','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) inventory_units table
CREATE TABLE IF NOT EXISTS public.inventory_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  serial text,
  internal_code text,
  owner_id uuid,
  agreement_type public.finance_agreement_type NOT NULL DEFAULT 'company_owned',
  owner_split_pct numeric NOT NULL DEFAULT 0,
  acquisition_value numeric NOT NULL DEFAULT 0,
  target_recovery_value numeric NOT NULL DEFAULT 0,
  status public.inventory_unit_status NOT NULL DEFAULT 'active',
  maintenance_notes text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_units TO authenticated;
GRANT ALL ON public.inventory_units TO service_role;

ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inventory_units"
  ON public.inventory_units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_inventory_units_product ON public.inventory_units(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_units_owner ON public.inventory_units(owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_units_active ON public.inventory_units(product_id) WHERE active = true;

CREATE TRIGGER trg_inventory_units_updated_at
  BEFORE UPDATE ON public.inventory_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit
CREATE TRIGGER trg_inventory_units_audit
  AFTER UPDATE OR DELETE ON public.inventory_units
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

-- 3) Add inventory_unit_id to booking_items, finance_entries, finance_payouts
ALTER TABLE public.booking_items
  ADD COLUMN IF NOT EXISTS inventory_unit_id uuid;

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS inventory_unit_id uuid;

ALTER TABLE public.finance_payouts
  ADD COLUMN IF NOT EXISTS inventory_unit_id uuid,
  ADD COLUMN IF NOT EXISTS product_name text;

CREATE INDEX IF NOT EXISTS idx_finance_entries_unit ON public.finance_entries(inventory_unit_id);
CREATE INDEX IF NOT EXISTS idx_finance_payouts_unit ON public.finance_payouts(inventory_unit_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_unit ON public.booking_items(inventory_unit_id);

-- 4) Unique active asset per product (fix owner persistence bug for legacy ProductOwnerDeal)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_finance_assets_active_product
  ON public.finance_assets(product_id) WHERE active = true AND product_id IS NOT NULL;

-- 5) Backfill inventory_units from existing finance_assets that have a product_id
INSERT INTO public.inventory_units (
  product_id, owner_id, agreement_type, owner_split_pct,
  acquisition_value, target_recovery_value, notes, active
)
SELECT
  fa.product_id,
  fa.owner_id,
  fa.agreement_type,
  COALESCE(fa.owner_split_pct, 0),
  COALESCE(fa.acquisition_value, 0),
  COALESCE(fa.target_recovery_value, 0),
  COALESCE(fa.notes, '') || ' [migrated from finance_assets]',
  COALESCE(fa.active, true)
FROM public.finance_assets fa
WHERE fa.product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_units iu WHERE iu.product_id = fa.product_id
  );

-- 6) Refactor handle_booking_payment_change:
--    - resolve per item via inventory_unit_id (booking_items) OR first active unit of product
--    - NO synthetic fallback: if no unit & no owner -> company_owned (no payout)
CREATE OR REPLACE FUNCTION public.handle_booking_payment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item record;
  v_unit record;
  v_owner_id uuid;
  v_owner_pct numeric;
  v_company_pct numeric;
  v_company numeric;
  v_payout numeric;
  v_entry_id uuid;
  v_unit_id uuid;
  v_asset_id uuid;
  v_product_name text;
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    FOR v_item IN
      SELECT bi.*, bi.subtotal AS line_total FROM public.booking_items bi WHERE bi.booking_id = NEW.id
    LOOP
      v_unit := NULL;
      v_unit_id := v_item.inventory_unit_id;

      -- 1) explicit unit on booking item
      IF v_unit_id IS NOT NULL THEN
        SELECT * INTO v_unit FROM public.inventory_units WHERE id = v_unit_id AND active = true;
      END IF;

      -- 2) fallback: first active unit of the product
      IF v_unit IS NULL THEN
        SELECT * INTO v_unit
        FROM public.inventory_units
        WHERE product_id = v_item.product_id AND active = true AND status = 'active'
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_unit.id IS NOT NULL THEN
          v_unit_id := v_unit.id;
          UPDATE public.booking_items SET inventory_unit_id = v_unit_id WHERE id = v_item.id;
        END IF;
      END IF;

      -- 3) resolve owner & split (NO synthetic fallback)
      IF v_unit.id IS NULL THEN
        v_owner_id := NULL;
        v_owner_pct := 0;
        v_company_pct := 100;
      ELSE
        v_owner_id := v_unit.owner_id;
        v_owner_pct := COALESCE(v_unit.owner_split_pct, 0);
        IF v_unit.agreement_type = 'company_owned' OR v_owner_id IS NULL THEN
          v_owner_pct := 0;
        END IF;
        v_company_pct := 100 - v_owner_pct;
      END IF;

      v_company := ROUND(v_item.line_total * v_company_pct / 100.0, 2);
      v_payout  := ROUND(v_item.line_total - v_company, 2);

      SELECT id INTO v_asset_id FROM public.finance_assets
        WHERE product_id = v_item.product_id AND active = true LIMIT 1;

      SELECT name_es INTO v_product_name FROM public.products WHERE id = v_item.product_id;

      INSERT INTO public.finance_entries
        (origin_system, source_type, booking_id, booking_item_id, asset_id, owner_id,
         inventory_unit_id, gross_amount, company_amount, payout_amount, applied_company_pct,
         occurred_at, notes, status)
      VALUES
        ('rental','order_paid', NEW.id, v_item.id, v_asset_id, v_owner_id,
         v_unit_id, v_item.line_total, v_company, v_payout, v_company_pct, now(),
         CASE WHEN v_unit.id IS NULL THEN 'No unit assigned (company_owned default)'
              ELSE 'Auto: ' || NEW.reference || ' / ' || COALESCE(v_product_name, v_item.product_name) END,
         'active')
      RETURNING id INTO v_entry_id;

      -- audit warning if undefined ownership
      IF v_unit.id IS NULL THEN
        INSERT INTO public.booking_audit_log (booking_id, actor_user_id, action, changes, entity_type, entity_id)
        VALUES (NEW.id, auth.uid(), 'warning:no_inventory_unit',
          jsonb_build_object('booking_item_id', v_item.id, 'product_id', v_item.product_id,
                             'message', 'Booking item paid without inventory unit; treated as company-owned, no payout created'),
          'booking_items', v_item.id);
      END IF;

      -- only create payout if there is an actual owner-bound payout > 0
      IF v_payout > 0 AND v_owner_id IS NOT NULL THEN
        INSERT INTO public.finance_payouts
          (asset_id, entry_id, owner_id, owner_label, inventory_unit_id, product_name,
           amount, applied_pct, status, notes, paid_amount)
        VALUES
          (v_asset_id, v_entry_id, v_owner_id,
           (SELECT name FROM public.finance_owners WHERE id = v_owner_id),
           v_unit_id, COALESCE(v_product_name, v_item.product_name),
           v_payout, v_owner_pct, 'unpaid',
           'Auto from booking ' || NEW.reference, 0);
      END IF;
    END LOOP;
  END IF;

  IF NEW.payment_status = 'refunded' AND (OLD.payment_status IS DISTINCT FROM 'refunded') THEN
    INSERT INTO public.finance_entries
      (origin_system, source_type, booking_id, booking_item_id, asset_id, owner_id, inventory_unit_id,
       gross_amount, company_amount, payout_amount, applied_company_pct,
       occurred_at, notes, status, is_reversed)
    SELECT origin_system, 'refund', booking_id, booking_item_id, asset_id, owner_id, inventory_unit_id,
           -gross_amount, -company_amount, -payout_amount, applied_company_pct,
           now(), 'Refund of booking ' || NEW.reference, 'active', false
    FROM public.finance_entries
    WHERE booking_id = NEW.id AND source_type = 'order_paid' AND is_reversed = false;

    UPDATE public.finance_entries
    SET is_reversed = true, status = 'reversed'
    WHERE booking_id = NEW.id AND source_type = 'order_paid';

    UPDATE public.finance_payouts
    SET status = 'cancelled'
    WHERE entry_id IN (SELECT id FROM public.finance_entries WHERE booking_id = NEW.id)
      AND status IN ('unpaid','partially_paid','pending');

    IF NEW.refunded_at IS NULL THEN NEW.refunded_at := now(); END IF;
  END IF;

  RETURN NEW;
END;
$function$;
