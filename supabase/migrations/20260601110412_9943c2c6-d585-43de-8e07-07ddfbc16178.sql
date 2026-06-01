
-- 0. Loosen price validator: skip on UPDATE when pricing fields unchanged
CREATE OR REPLACE FUNCTION public.validate_booking_item_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_product record;
  v_unit_total numeric;
  v_auto_subtotal numeric;
  v_max_subtotal numeric;
  v_min_subtotal numeric;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Skip re-validation on UPDATEs that don't touch pricing fields
  IF TG_OP = 'UPDATE' AND
     OLD.product_id IS NOT DISTINCT FROM NEW.product_id AND
     OLD.variant_id IS NOT DISTINCT FROM NEW.variant_id AND
     OLD.price_day  IS NOT DISTINCT FROM NEW.price_day  AND
     OLD.quantity   IS NOT DISTINCT FROM NEW.quantity   AND
     OLD.days       IS NOT DISTINCT FROM NEW.days       AND
     OLD.subtotal   IS NOT DISTINCT FROM NEW.subtotal THEN
    RETURN NEW;
  END IF;

  IF NEW.product_id IS NULL THEN
    RAISE EXCEPTION 'product_id is required';
  END IF;

  SELECT p.id, p.published, p.price_day, p.price_week, p.pricing_model, p.pricing_multipliers
    INTO v_product
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF NOT FOUND OR NOT v_product.published THEN
    RAISE EXCEPTION 'Product not found or unpublished';
  END IF;

  IF NOT (
    ABS(NEW.price_day - v_product.price_day) <= 0.01
    OR EXISTS (
      SELECT 1 FROM public.product_variants v
      WHERE v.product_id = NEW.product_id
        AND ABS(NEW.price_day - v.price_day) <= 0.01
    )
  ) THEN
    RAISE EXCEPTION 'Invalid price_day for product';
  END IF;

  IF NEW.quantity <= 0 OR NEW.days <= 0 OR NEW.days > 7 THEN
    RAISE EXCEPTION 'Invalid quantity or days';
  END IF;

  v_unit_total := public.calc_rental_unit_total(
    NEW.price_day, NEW.days,
    v_product.pricing_model, v_product.pricing_multipliers, v_product.price_week
  );
  v_auto_subtotal := v_unit_total * NEW.quantity;
  v_max_subtotal := v_auto_subtotal + 0.01;
  v_min_subtotal := v_auto_subtotal * 0.55;

  IF NEW.subtotal < v_min_subtotal - 0.01 THEN
    RAISE EXCEPTION 'Subtotal too low (got %, min %)', NEW.subtotal, v_min_subtotal;
  END IF;
  IF NEW.subtotal > v_max_subtotal THEN
    RAISE EXCEPTION 'Subtotal too high (got %, max %)', NEW.subtotal, v_max_subtotal;
  END IF;

  NEW.pricing_model := v_product.pricing_model::text;
  IF NEW.auto_subtotal IS NULL THEN
    NEW.auto_subtotal := v_auto_subtotal;
  END IF;

  RETURN NEW;
END;
$function$;

-- 1. Schema additions
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS paid_at timestamptz;
UPDATE public.bookings SET paid_at = updated_at WHERE payment_status = 'paid' AND paid_at IS NULL;

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS agreement_type_snapshot public.finance_agreement_type,
  ADD COLUMN IF NOT EXISTS subtotal_snapshot numeric;
ALTER TABLE public.finance_payouts
  ADD COLUMN IF NOT EXISTS agreement_type_snapshot public.finance_agreement_type;

CREATE TABLE IF NOT EXISTS public.owner_product_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL,
  agreement_type public.finance_agreement_type NOT NULL DEFAULT 'split_70_30',
  owner_split_pct numeric NOT NULL DEFAULT 30,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_product_agreements TO authenticated;
GRANT ALL ON public.owner_product_agreements TO service_role;
ALTER TABLE public.owner_product_agreements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage owner_product_agreements" ON public.owner_product_agreements;
CREATE POLICY "Admins manage owner_product_agreements"
  ON public.owner_product_agreements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS trg_opa_updated_at ON public.owner_product_agreements;
CREATE TRIGGER trg_opa_updated_at BEFORE UPDATE ON public.owner_product_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$ BEGIN
  CREATE TYPE public.finance_expense_kind AS ENUM ('operational','asset_purchase');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS kind public.finance_expense_kind NOT NULL DEFAULT 'operational',
  ADD COLUMN IF NOT EXISTS asset_id_created uuid;

-- 2. finance_summary v2
DROP VIEW IF EXISTS public.finance_equity_distribution;
DROP FUNCTION IF EXISTS public.finance_summary(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.finance_summary(_start timestamptz, _end timestamptz)
 RETURNS TABLE(rental_income numeric, store_income numeric, services_income numeric,
   payouts_paid numeric, payouts_pending numeric, payouts_partial numeric,
   owner_liability_open numeric, expenses_total numeric, asset_purchases_total numeric,
   debt_repaid numeric, cash_balance numeric, cash_reserve_target numeric, distributable numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH
    inc AS (
      SELECT
        COALESCE(SUM(company_amount) FILTER (WHERE origin_system='rental'   AND status='active'), 0) AS rental_income,
        COALESCE(SUM(company_amount) FILTER (WHERE origin_system='store'    AND status='active'), 0) AS store_income,
        COALESCE(SUM(company_amount) FILTER (WHERE origin_system='services' AND status='active'), 0) AS services_income
      FROM public.finance_entries WHERE occurred_at >= _start AND occurred_at < _end
    ),
    po AS (
      SELECT
        COALESCE(SUM(paid_amount), 0) AS payouts_paid_total,
        COALESCE(SUM(amount - paid_amount) FILTER (WHERE status IN ('unpaid','partially_paid','pending')), 0) AS payouts_pending_total,
        COALESCE(SUM(paid_amount) FILTER (WHERE status='partially_paid'), 0) AS payouts_partial_total
      FROM public.finance_payouts
    ),
    ex AS (
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE kind='operational'), 0) AS expenses_total,
        COALESCE(SUM(amount) FILTER (WHERE kind='asset_purchase'), 0) AS asset_purchases_total
      FROM public.finance_expenses WHERE occurred_at >= _start AND occurred_at < _end
    ),
    dr AS (
      SELECT COALESCE(SUM(amount), 0) AS debt_repaid FROM public.finance_debt_repayments
      WHERE paid_at >= _start AND paid_at < _end
    ),
    cash AS (
      SELECT
        COALESCE((SELECT SUM(company_amount) FROM public.finance_entries WHERE status='active'), 0)
        - COALESCE((SELECT SUM(amount) FROM public.finance_expenses WHERE kind='operational'), 0)
        - COALESCE((SELECT SUM(amount) FROM public.finance_debt_repayments), 0) AS cash_balance
    ),
    res AS (
      SELECT COALESCE(target_amount, 0) AS cash_reserve_target FROM public.finance_cash_reserve WHERE id = true
    )
  SELECT
    inc.rental_income, inc.store_income, inc.services_income,
    po.payouts_paid_total, po.payouts_pending_total, po.payouts_partial_total,
    po.payouts_pending_total AS owner_liability_open,
    ex.expenses_total, ex.asset_purchases_total, dr.debt_repaid,
    cash.cash_balance,
    COALESCE(res.cash_reserve_target, 0),
    (inc.rental_income + inc.store_income + inc.services_income)
      - ex.expenses_total - COALESCE(res.cash_reserve_target, 0) AS distributable
  FROM inc, po, ex, dr, cash LEFT JOIN res ON true;
$function$;

CREATE OR REPLACE VIEW public.finance_equity_distribution AS
WITH dist AS (
  SELECT distributable
  FROM public.finance_summary(date_trunc('year', now()), date_trunc('year', now()) + interval '1 year')
)
SELECT p.id AS partner_id, p.name, p.profit_share_pct AS equity_pct,
       d.distributable,
       round(d.distributable * p.profit_share_pct / 100.0, 2) AS would_receive
FROM public.finance_partners p
CROSS JOIN dist d
ORDER BY p.sort_order, p.name;

GRANT SELECT ON public.finance_equity_distribution TO authenticated;
GRANT ALL ON public.finance_equity_distribution TO service_role;

-- 3. New trigger
CREATE OR REPLACE FUNCTION public.handle_booking_payment_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_item record; v_unit record; v_override record;
  v_has_unit boolean;
  v_owner_id uuid; v_owner_pct numeric; v_company_pct numeric;
  v_agreement public.finance_agreement_type;
  v_company numeric; v_payout numeric; v_entry_id uuid;
  v_unit_id uuid; v_asset_id uuid; v_product_name text; v_paid_at timestamptz;
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    IF NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
    v_paid_at := NEW.paid_at;

    FOR v_item IN
      SELECT bi.*, bi.subtotal AS line_total FROM public.booking_items bi WHERE bi.booking_id = NEW.id
    LOOP
      v_has_unit := false;
      v_unit_id := v_item.inventory_unit_id;
      v_owner_id := NULL; v_owner_pct := 0; v_agreement := 'company_owned';

      IF v_unit_id IS NOT NULL THEN
        SELECT * INTO v_unit FROM public.inventory_units WHERE id = v_unit_id AND active = true;
        IF FOUND THEN v_has_unit := true; END IF;
      END IF;
      IF NOT v_has_unit THEN
        SELECT * INTO v_unit FROM public.inventory_units
        WHERE product_id = v_item.product_id AND active = true AND status = 'active'
        ORDER BY created_at ASC LIMIT 1;
        IF FOUND THEN
          v_has_unit := true;
          v_unit_id := v_unit.id;
          UPDATE public.booking_items SET inventory_unit_id = v_unit_id WHERE id = v_item.id;
        END IF;
      END IF;

      IF v_has_unit AND v_unit.owner_id IS NOT NULL AND v_unit.agreement_type <> 'company_owned' THEN
        v_owner_id := v_unit.owner_id;
        v_agreement := v_unit.agreement_type;
        v_owner_pct := COALESCE(v_unit.owner_split_pct, 0);

        SELECT * INTO v_override FROM public.owner_product_agreements
        WHERE owner_id = v_owner_id AND product_id = v_item.product_id;
        IF FOUND THEN
          v_agreement := v_override.agreement_type;
          v_owner_pct := COALESCE(v_override.owner_split_pct, v_owner_pct);
        END IF;
      END IF;

      v_company_pct := 100 - v_owner_pct;
      v_company := ROUND(v_item.line_total * v_company_pct / 100.0, 2);
      v_payout  := ROUND(v_item.line_total - v_company, 2);

      SELECT id INTO v_asset_id FROM public.finance_assets
        WHERE product_id = v_item.product_id AND active = true LIMIT 1;
      SELECT name_es INTO v_product_name FROM public.products WHERE id = v_item.product_id;

      INSERT INTO public.finance_entries
        (origin_system, source_type, booking_id, booking_item_id, asset_id, owner_id,
         inventory_unit_id, gross_amount, company_amount, payout_amount,
         applied_company_pct, agreement_type_snapshot, subtotal_snapshot,
         occurred_at, notes, status)
      VALUES
        ('rental','order_paid', NEW.id, v_item.id, v_asset_id, v_owner_id,
         v_unit_id, v_item.line_total, v_company, v_payout,
         v_company_pct, v_agreement, v_item.line_total,
         v_paid_at,
         CASE WHEN v_owner_id IS NULL
              THEN 'Company-owned (no owner): ' || NEW.reference || ' / ' || COALESCE(v_product_name, v_item.product_name)
              ELSE 'Auto: ' || NEW.reference || ' / ' || COALESCE(v_product_name, v_item.product_name) END,
         'active')
      RETURNING id INTO v_entry_id;

      IF v_owner_id IS NULL THEN
        INSERT INTO public.booking_audit_log (booking_id, actor_user_id, action, changes, entity_type, entity_id)
        VALUES (NEW.id, auth.uid(), 'warning:no_owner_assigned',
          jsonb_build_object('booking_item_id', v_item.id, 'product_id', v_item.product_id,
                             'message', 'Paid without owner; treated as company-owned, no payout'),
          'booking_items', v_item.id);
      END IF;

      IF v_payout > 0 AND v_owner_id IS NOT NULL THEN
        INSERT INTO public.finance_payouts
          (asset_id, entry_id, owner_id, owner_label, inventory_unit_id, product_name,
           amount, applied_pct, agreement_type_snapshot, status, notes, paid_amount)
        VALUES
          (v_asset_id, v_entry_id, v_owner_id,
           (SELECT name FROM public.finance_owners WHERE id = v_owner_id),
           v_unit_id, COALESCE(v_product_name, v_item.product_name),
           v_payout, v_owner_pct, v_agreement, 'unpaid',
           'Auto from booking ' || NEW.reference || ' (paid ' || to_char(v_paid_at,'YYYY-MM-DD') || ')', 0);
      END IF;
    END LOOP;
  END IF;

  IF NEW.payment_status = 'refunded' AND (OLD.payment_status IS DISTINCT FROM 'refunded') THEN
    INSERT INTO public.finance_entries
      (origin_system, source_type, booking_id, booking_item_id, asset_id, owner_id, inventory_unit_id,
       gross_amount, company_amount, payout_amount, applied_company_pct,
       agreement_type_snapshot, subtotal_snapshot,
       occurred_at, notes, status, is_reversed)
    SELECT origin_system, 'refund', booking_id, booking_item_id, asset_id, owner_id, inventory_unit_id,
           -gross_amount, -company_amount, -payout_amount, applied_company_pct,
           agreement_type_snapshot, -COALESCE(subtotal_snapshot, gross_amount),
           now(), 'Refund of booking ' || NEW.reference, 'active', false
    FROM public.finance_entries
    WHERE booking_id = NEW.id AND source_type = 'order_paid' AND is_reversed = false;

    UPDATE public.finance_payouts
    SET status = 'cancelled'
    WHERE entry_id IN (SELECT id FROM public.finance_entries WHERE booking_id = NEW.id AND source_type = 'order_paid')
      AND status IN ('unpaid','partially_paid','pending');

    IF NEW.refunded_at IS NULL THEN NEW.refunded_at := now(); END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Wipe & regenerate
DELETE FROM public.finance_payout_payments;
DELETE FROM public.finance_payouts;
DELETE FROM public.finance_entries WHERE source_type IN ('order_paid','refund');

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.bookings WHERE payment_status = 'paid' LOOP
    UPDATE public.bookings SET paid_at = NULL, payment_status = 'unpaid' WHERE id = r.id;
    UPDATE public.bookings SET payment_status = 'paid' WHERE id = r.id;
  END LOOP;
END $$;
