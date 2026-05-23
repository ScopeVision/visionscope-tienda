
-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.finance_owner_type AS ENUM ('socio','external','concession','company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_entry_status AS ENUM ('active','reversed','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. finance_owners
CREATE TABLE IF NOT EXISTS public.finance_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.finance_owner_type NOT NULL DEFAULT 'external',
  default_company_pct numeric NOT NULL DEFAULT 30,
  contact_email text,
  contact_phone text,
  notes text,
  partner_id uuid REFERENCES public.finance_partners(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_owners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage finance_owners" ON public.finance_owners;
CREATE POLICY "Admins manage finance_owners" ON public.finance_owners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_finance_owners_updated BEFORE UPDATE ON public.finance_owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. finance_assets extensions
ALTER TABLE public.finance_assets
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.finance_owners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_recovery_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS concession_rules jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. finance_entries extensions
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS booking_item_id uuid,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.finance_owners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_company_pct numeric,
  ADD COLUMN IF NOT EXISTS is_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS status public.finance_entry_status NOT NULL DEFAULT 'active';

-- 5. finance_payouts extensions
ALTER TABLE public.finance_payouts
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.finance_owners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_pct numeric,
  ADD COLUMN IF NOT EXISTS is_manual_override boolean NOT NULL DEFAULT false;

-- 6. partner share history
CREATE TABLE IF NOT EXISTS public.finance_partner_share_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.finance_partners(id) ON DELETE CASCADE,
  pct numeric NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_partner_share_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage finance_partner_share_history" ON public.finance_partner_share_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- 7. finance_settings singleton
CREATE TABLE IF NOT EXISTS public.finance_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  default_split_company_pct numeric NOT NULL DEFAULT 30,
  default_currency text NOT NULL DEFAULT 'EUR',
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage finance_settings" ON public.finance_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
INSERT INTO public.finance_settings (id, default_split_company_pct)
  VALUES (true, 30) ON CONFLICT (id) DO NOTHING;

-- 8. booking_audit_log extension (entity-agnostic)
ALTER TABLE public.booking_audit_log
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.booking_audit_log
  ALTER COLUMN booking_id DROP NOT NULL;

-- 9. Seed owners from existing partners
INSERT INTO public.finance_owners (name, type, default_company_pct, partner_id, notes, sort_order)
SELECT p.name, 'socio'::public.finance_owner_type, 30, p.id, p.notes, p.sort_order
FROM public.finance_partners p
WHERE NOT EXISTS (SELECT 1 FROM public.finance_owners o WHERE o.partner_id = p.id);

-- 10. Rewrite trigger: per-item entry + owner resolution + fallback to settings
CREATE OR REPLACE FUNCTION public.handle_booking_payment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item record;
  v_asset record;
  v_owner_id uuid;
  v_company_pct numeric;
  v_company numeric;
  v_payout numeric;
  v_entry_id uuid;
  v_default_pct numeric;
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    SELECT default_split_company_pct INTO v_default_pct FROM public.finance_settings WHERE id = true;
    v_default_pct := COALESCE(v_default_pct, 100);

    FOR v_item IN
      SELECT bi.*, bi.subtotal AS line_total
      FROM public.booking_items bi
      WHERE bi.booking_id = NEW.id
    LOOP
      SELECT * INTO v_asset
      FROM public.finance_assets
      WHERE product_id = v_item.product_id AND active = true
      LIMIT 1;

      IF v_asset.id IS NULL THEN
        v_company_pct := v_default_pct;
        v_owner_id := NULL;
      ELSE
        v_company_pct := CASE v_asset.revenue_model
          WHEN 'company_100' THEN 100
          WHEN 'split_70_30' THEN 30
          WHEN 'custom' THEN COALESCE(v_asset.custom_company_pct, v_default_pct)
        END;
        v_owner_id := v_asset.owner_id;
      END IF;

      v_company := ROUND(v_item.line_total * v_company_pct / 100.0, 2);
      v_payout := ROUND(v_item.line_total - v_company, 2);

      INSERT INTO public.finance_entries
        (origin_system, source_type, booking_id, booking_item_id, asset_id, owner_id,
         gross_amount, company_amount, payout_amount, applied_company_pct,
         occurred_at, notes, status)
      VALUES
        ('rental','order_paid', NEW.id, v_item.id, v_asset.id, v_owner_id,
         v_item.line_total, v_company, v_payout, v_company_pct,
         now(),
         'Auto: ' || NEW.reference || ' / ' || v_item.product_name,
         'active')
      RETURNING id INTO v_entry_id;

      IF v_payout > 0 THEN
        INSERT INTO public.finance_payouts
          (asset_id, entry_id, owner_id, owner_label, amount, applied_pct, status, notes)
        VALUES
          (v_asset.id, v_entry_id, v_owner_id,
           COALESCE((SELECT name FROM public.finance_owners WHERE id = v_owner_id), v_asset.owner_label),
           v_payout, 100 - v_company_pct, 'pending',
           'Auto from booking ' || NEW.reference);
      END IF;
    END LOOP;
  END IF;

  IF NEW.payment_status = 'refunded' AND (OLD.payment_status IS DISTINCT FROM 'refunded') THEN
    INSERT INTO public.finance_entries
      (origin_system, source_type, booking_id, booking_item_id, asset_id, owner_id,
       gross_amount, company_amount, payout_amount, applied_company_pct,
       occurred_at, notes, status, is_reversed)
    SELECT origin_system, 'refund', booking_id, booking_item_id, asset_id, owner_id,
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
      AND status = 'pending';

    IF NEW.refunded_at IS NULL THEN
      NEW.refunded_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_booking_payment_change ON public.bookings;
CREATE TRIGGER trg_booking_payment_change
BEFORE UPDATE OF payment_status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.handle_booking_payment_change();

-- 11. Generic finance audit trigger
CREATE OR REPLACE FUNCTION public.finance_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_diff jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_diff := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
    INSERT INTO public.booking_audit_log (booking_id, actor_user_id, action, changes, entity_type, entity_id)
    VALUES (NULL, auth.uid(), TG_OP || ':' || TG_TABLE_NAME, v_diff, TG_TABLE_NAME, NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.booking_audit_log (booking_id, actor_user_id, action, changes, entity_type, entity_id)
    VALUES (NULL, auth.uid(), TG_OP || ':' || TG_TABLE_NAME, jsonb_build_object('before', to_jsonb(OLD)), TG_TABLE_NAME, OLD.id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_finance_entries ON public.finance_entries;
CREATE TRIGGER trg_audit_finance_entries
AFTER UPDATE OR DELETE ON public.finance_entries
FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_finance_payouts ON public.finance_payouts;
CREATE TRIGGER trg_audit_finance_payouts
AFTER UPDATE OR DELETE ON public.finance_payouts
FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_finance_assets ON public.finance_assets;
CREATE TRIGGER trg_audit_finance_assets
AFTER UPDATE OR DELETE ON public.finance_assets
FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_finance_owners ON public.finance_owners;
CREATE TRIGGER trg_audit_finance_owners
AFTER UPDATE OR DELETE ON public.finance_owners
FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_finance_partners ON public.finance_partners;
CREATE TRIGGER trg_audit_finance_partners
AFTER UPDATE OR DELETE ON public.finance_partners
FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

-- 12. Partner share history trigger
CREATE OR REPLACE FUNCTION public.track_partner_share()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.profit_share_pct IS DISTINCT FROM NEW.profit_share_pct) THEN
    UPDATE public.finance_partner_share_history
      SET effective_to = now()
      WHERE partner_id = NEW.id AND effective_to IS NULL;
    INSERT INTO public.finance_partner_share_history (partner_id, pct, note, created_by)
      VALUES (NEW.id, NEW.profit_share_pct, 'auto', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_track_partner_share ON public.finance_partners;
CREATE TRIGGER trg_track_partner_share
AFTER INSERT OR UPDATE ON public.finance_partners
FOR EACH ROW EXECUTE FUNCTION public.track_partner_share();
