
-- 1. Owner snapshot columns (immutability)
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS owner_split_pct_snapshot numeric;
ALTER TABLE public.finance_payouts
  ADD COLUMN IF NOT EXISTS owner_split_pct_snapshot numeric;

-- 2. Reconciliation notes table
CREATE TABLE IF NOT EXISTS public.finance_reconciliation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  note text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_reconciliation_notes TO authenticated;
GRANT ALL ON public.finance_reconciliation_notes TO service_role;
ALTER TABLE public.finance_reconciliation_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage finance_reconciliation_notes" ON public.finance_reconciliation_notes;
CREATE POLICY "Admins manage finance_reconciliation_notes"
  ON public.finance_reconciliation_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS finance_reconciliation_notes_updated ON public.finance_reconciliation_notes;
CREATE TRIGGER finance_reconciliation_notes_updated
  BEFORE UPDATE ON public.finance_reconciliation_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Invariant check function
CREATE OR REPLACE FUNCTION public.validate_booking_finance_invariant(_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_sum numeric;
  v_ref text;
  v_status payment_status;
  v_diff numeric;
BEGIN
  SELECT total, reference, payment_status INTO v_total, v_ref, v_status
    FROM public.bookings WHERE id = _booking_id;
  IF NOT FOUND OR v_status <> 'paid' THEN RETURN true; END IF;

  SELECT COALESCE(SUM(gross_amount), 0) INTO v_sum
    FROM public.finance_entries
   WHERE booking_id = _booking_id AND status = 'active' AND source_type = 'order_paid';

  v_diff := ROUND(v_sum - v_total, 2);
  IF ABS(v_diff) >= 0.01 THEN
    INSERT INTO public.booking_audit_log (booking_id, actor_user_id, action, changes, entity_type, entity_id)
    VALUES (_booking_id, auth.uid(), 'warning:finance_invariant_violation',
      jsonb_build_object('booking_reference', v_ref, 'booking_total', v_total,
                         'sum_entries', v_sum, 'delta', v_diff),
      'bookings', _booking_id);
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

-- 4. Trigger on finance_entries that checks invariant after change
CREATE OR REPLACE FUNCTION public.trg_finance_entries_invariant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_bid uuid;
BEGIN
  v_bid := COALESCE(NEW.booking_id, OLD.booking_id);
  IF v_bid IS NOT NULL THEN
    PERFORM public.validate_booking_finance_invariant(v_bid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS finance_entries_invariant_check ON public.finance_entries;
CREATE TRIGGER finance_entries_invariant_check
  AFTER INSERT OR UPDATE OR DELETE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_finance_entries_invariant();

-- 5. Rewritten booking payment trigger: charged amount + immutable snapshot
CREATE OR REPLACE FUNCTION public.handle_booking_payment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record; v_unit record; v_override record;
  v_has_unit boolean;
  v_owner_id uuid; v_owner_pct numeric; v_company_pct numeric;
  v_agreement public.finance_agreement_type;
  v_company numeric; v_payout numeric; v_entry_id uuid;
  v_unit_id uuid; v_asset_id uuid; v_product_name text; v_paid_at timestamptz;
  v_sum_items numeric; v_running numeric := 0; v_line_charged numeric;
  v_items_count int; v_idx int := 0; v_total numeric;
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    IF NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
    v_paid_at := NEW.paid_at;
    v_total := NEW.total;

    SELECT COALESCE(SUM(subtotal), 0), COUNT(*)
      INTO v_sum_items, v_items_count
      FROM public.booking_items WHERE booking_id = NEW.id;

    FOR v_item IN
      SELECT bi.* FROM public.booking_items bi
      WHERE bi.booking_id = NEW.id
      ORDER BY bi.created_at, bi.id
    LOOP
      v_idx := v_idx + 1;

      -- Proportional charged amount; last item absorbs rounding remainder
      IF v_idx = v_items_count THEN
        v_line_charged := ROUND(v_total - v_running, 2);
      ELSIF v_sum_items > 0 THEN
        v_line_charged := ROUND(v_item.subtotal * v_total / v_sum_items, 2);
      ELSE
        v_line_charged := ROUND(v_total / GREATEST(v_items_count,1), 2);
      END IF;
      v_running := v_running + v_line_charged;

      -- Resolve unit / owner / agreement (snapshot at payment time)
      v_has_unit := false; v_unit_id := v_item.inventory_unit_id;
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
          v_has_unit := true; v_unit_id := v_unit.id;
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
      v_company := ROUND(v_line_charged * v_company_pct / 100.0, 2);
      v_payout  := ROUND(v_line_charged - v_company, 2);

      SELECT id INTO v_asset_id FROM public.finance_assets
        WHERE product_id = v_item.product_id AND active = true LIMIT 1;
      SELECT name_es INTO v_product_name FROM public.products WHERE id = v_item.product_id;

      INSERT INTO public.finance_entries
        (origin_system, source_type, booking_id, booking_item_id, asset_id, owner_id,
         inventory_unit_id, gross_amount, company_amount, payout_amount,
         applied_company_pct, owner_split_pct_snapshot,
         agreement_type_snapshot, subtotal_snapshot,
         occurred_at, notes, status)
      VALUES
        ('rental','order_paid', NEW.id, v_item.id, v_asset_id, v_owner_id,
         v_unit_id, v_line_charged, v_company, v_payout,
         v_company_pct, v_owner_pct, v_agreement, v_line_charged,
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
           amount, applied_pct, owner_split_pct_snapshot,
           agreement_type_snapshot, status, notes, paid_amount)
        VALUES
          (v_asset_id, v_entry_id, v_owner_id,
           (SELECT name FROM public.finance_owners WHERE id = v_owner_id),
           v_unit_id, COALESCE(v_product_name, v_item.product_name),
           v_payout, v_owner_pct, v_owner_pct, v_agreement, 'unpaid',
           'Auto from booking ' || NEW.reference || ' (paid ' || to_char(v_paid_at,'YYYY-MM-DD') || ')', 0);
      END IF;
    END LOOP;

    PERFORM public.validate_booking_finance_invariant(NEW.id);
  END IF;

  IF NEW.payment_status = 'refunded' AND (OLD.payment_status IS DISTINCT FROM 'refunded') THEN
    INSERT INTO public.finance_entries
      (origin_system, source_type, booking_id, booking_item_id, asset_id, owner_id, inventory_unit_id,
       gross_amount, company_amount, payout_amount, applied_company_pct, owner_split_pct_snapshot,
       agreement_type_snapshot, subtotal_snapshot,
       occurred_at, notes, status, is_reversed)
    SELECT origin_system, 'refund', booking_id, booking_item_id, asset_id, owner_id, inventory_unit_id,
           -gross_amount, -company_amount, -payout_amount, applied_company_pct, owner_split_pct_snapshot,
           agreement_type_snapshot, -COALESCE(subtotal_snapshot, gross_amount),
           COALESCE(NEW.refunded_at, now()), 'Refund of booking ' || NEW.reference, 'active', false
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
$$;

-- 6. finance_summary v2: by booking.start_date and paid only
CREATE OR REPLACE FUNCTION public.finance_summary(_start timestamptz, _end timestamptz)
RETURNS TABLE(rental_income numeric, store_income numeric, services_income numeric,
              payouts_paid numeric, payouts_pending numeric, payouts_partial numeric,
              owner_liability_open numeric, expenses_total numeric, asset_purchases_total numeric,
              debt_repaid numeric, cash_balance numeric, cash_reserve_target numeric, distributable numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH
    inc AS (
      SELECT
        COALESCE(SUM(fe.company_amount) FILTER (WHERE fe.origin_system='rental'   AND fe.status='active'), 0) AS rental_income,
        COALESCE(SUM(fe.company_amount) FILTER (WHERE fe.origin_system='store'    AND fe.status='active'), 0) AS store_income,
        COALESCE(SUM(fe.company_amount) FILTER (WHERE fe.origin_system='services' AND fe.status='active'), 0) AS services_income
      FROM public.finance_entries fe
      JOIN public.bookings b ON b.id = fe.booking_id
      WHERE b.payment_status = 'paid'
        AND b.start_date >= (_start)::date
        AND b.start_date <  (_end)::date
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
        COALESCE((SELECT SUM(fe.company_amount) FROM public.finance_entries fe
                   JOIN public.bookings b ON b.id = fe.booking_id
                  WHERE fe.status='active' AND b.payment_status='paid'), 0)
        - COALESCE((SELECT SUM(amount) FROM public.finance_expenses WHERE kind='operational'), 0)
        - COALESCE((SELECT SUM(amount) FROM public.finance_debt_repayments), 0) AS cash_balance
    ),
    res AS (
      SELECT COALESCE(target_amount, 0) AS cash_reserve_target FROM public.finance_cash_reserve WHERE id = true
    )
  SELECT
    inc.rental_income, inc.store_income, inc.services_income,
    po.payouts_paid_total, po.payouts_pending_total, po.payouts_partial_total,
    po.payouts_pending_total, ex.expenses_total, ex.asset_purchases_total, dr.debt_repaid,
    cash.cash_balance, COALESCE(res.cash_reserve_target, 0),
    (inc.rental_income + inc.store_income + inc.services_income)
      - ex.expenses_total - COALESCE(res.cash_reserve_target, 0)
  FROM inc, po, ex, dr, cash LEFT JOIN res ON true;
$$;

-- 7. Period view: per-entry finance keyed by booking.start_date
DROP VIEW IF EXISTS public.finance_period_v;
CREATE VIEW public.finance_period_v
WITH (security_invoker = true)
AS
SELECT
  fe.id              AS entry_id,
  fe.booking_id,
  b.reference        AS booking_reference,
  b.start_date       AS period_date,
  to_char(b.start_date, 'YYYY-MM') AS period_month,
  b.paid_at,
  b.payment_status,
  b.status           AS booking_status,
  b.total            AS booking_total,
  fe.gross_amount,
  fe.company_amount,
  fe.payout_amount,
  fe.owner_id,
  fe.owner_split_pct_snapshot,
  fe.applied_company_pct,
  fe.agreement_type_snapshot,
  fe.source_type,
  fe.origin_system,
  fe.status          AS entry_status
FROM public.finance_entries fe
JOIN public.bookings b ON b.id = fe.booking_id
WHERE fe.status = 'active';

GRANT SELECT ON public.finance_period_v TO authenticated;

-- 8. Regenerate finance for all paid bookings
DO $regen$
DECLARE
  b record;
  v_item record; v_unit record; v_override record;
  v_has_unit boolean;
  v_owner_id uuid; v_owner_pct numeric; v_company_pct numeric;
  v_agreement public.finance_agreement_type;
  v_company numeric; v_payout numeric; v_entry_id uuid;
  v_unit_id uuid; v_asset_id uuid; v_product_name text;
  v_sum_items numeric; v_running numeric; v_line_charged numeric;
  v_items_count int; v_idx int; v_total numeric; v_paid_at timestamptz;
BEGIN
  -- wipe existing finance for paid bookings (clean rebuild)
  DELETE FROM public.finance_payout_payments
   WHERE payout_id IN (SELECT id FROM public.finance_payouts
                        WHERE entry_id IN (SELECT id FROM public.finance_entries
                                            WHERE booking_id IN (SELECT id FROM public.bookings WHERE payment_status='paid')));
  DELETE FROM public.finance_payouts
   WHERE entry_id IN (SELECT id FROM public.finance_entries
                       WHERE booking_id IN (SELECT id FROM public.bookings WHERE payment_status='paid'));
  DELETE FROM public.finance_entries
   WHERE booking_id IN (SELECT id FROM public.bookings WHERE payment_status='paid');

  FOR b IN SELECT * FROM public.bookings WHERE payment_status='paid' ORDER BY start_date LOOP
    v_paid_at := COALESCE(b.paid_at, b.start_date::timestamptz);
    v_total := b.total;
    SELECT COALESCE(SUM(subtotal),0), COUNT(*) INTO v_sum_items, v_items_count
      FROM public.booking_items WHERE booking_id = b.id;
    v_running := 0; v_idx := 0;

    FOR v_item IN SELECT * FROM public.booking_items WHERE booking_id = b.id ORDER BY created_at, id LOOP
      v_idx := v_idx + 1;
      IF v_idx = v_items_count THEN
        v_line_charged := ROUND(v_total - v_running, 2);
      ELSIF v_sum_items > 0 THEN
        v_line_charged := ROUND(v_item.subtotal * v_total / v_sum_items, 2);
      ELSE
        v_line_charged := ROUND(v_total / GREATEST(v_items_count,1), 2);
      END IF;
      v_running := v_running + v_line_charged;

      v_has_unit := false; v_unit_id := v_item.inventory_unit_id;
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
          v_has_unit := true; v_unit_id := v_unit.id;
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
      v_company := ROUND(v_line_charged * v_company_pct / 100.0, 2);
      v_payout  := ROUND(v_line_charged - v_company, 2);

      SELECT id INTO v_asset_id FROM public.finance_assets
        WHERE product_id = v_item.product_id AND active = true LIMIT 1;
      SELECT name_es INTO v_product_name FROM public.products WHERE id = v_item.product_id;

      INSERT INTO public.finance_entries
        (origin_system, source_type, booking_id, booking_item_id, asset_id, owner_id,
         inventory_unit_id, gross_amount, company_amount, payout_amount,
         applied_company_pct, owner_split_pct_snapshot,
         agreement_type_snapshot, subtotal_snapshot,
         occurred_at, notes, status)
      VALUES
        ('rental','order_paid', b.id, v_item.id, v_asset_id, v_owner_id,
         v_unit_id, v_line_charged, v_company, v_payout,
         v_company_pct, v_owner_pct, v_agreement, v_line_charged,
         v_paid_at,
         CASE WHEN v_owner_id IS NULL
              THEN 'Regen company-owned: ' || b.reference || ' / ' || COALESCE(v_product_name, v_item.product_name)
              ELSE 'Regen: ' || b.reference || ' / ' || COALESCE(v_product_name, v_item.product_name) END,
         'active')
      RETURNING id INTO v_entry_id;

      IF v_payout > 0 AND v_owner_id IS NOT NULL THEN
        INSERT INTO public.finance_payouts
          (asset_id, entry_id, owner_id, owner_label, inventory_unit_id, product_name,
           amount, applied_pct, owner_split_pct_snapshot,
           agreement_type_snapshot, status, notes, paid_amount)
        VALUES
          (v_asset_id, v_entry_id, v_owner_id,
           (SELECT name FROM public.finance_owners WHERE id = v_owner_id),
           v_unit_id, COALESCE(v_product_name, v_item.product_name),
           v_payout, v_owner_pct, v_owner_pct, v_agreement, 'unpaid',
           'Regen from booking ' || b.reference, 0);
      END IF;
    END LOOP;

    PERFORM public.validate_booking_finance_invariant(b.id);
  END LOOP;

  -- Replay refunds
  INSERT INTO public.finance_entries
    (origin_system, source_type, booking_id, booking_item_id, asset_id, owner_id, inventory_unit_id,
     gross_amount, company_amount, payout_amount, applied_company_pct, owner_split_pct_snapshot,
     agreement_type_snapshot, subtotal_snapshot,
     occurred_at, notes, status, is_reversed)
  SELECT fe.origin_system, 'refund', fe.booking_id, fe.booking_item_id, fe.asset_id, fe.owner_id, fe.inventory_unit_id,
         -fe.gross_amount, -fe.company_amount, -fe.payout_amount, fe.applied_company_pct, fe.owner_split_pct_snapshot,
         fe.agreement_type_snapshot, -COALESCE(fe.subtotal_snapshot, fe.gross_amount),
         COALESCE(bk.refunded_at, now()), 'Regen refund of booking ' || bk.reference, 'active', false
  FROM public.finance_entries fe
  JOIN public.bookings bk ON bk.id = fe.booking_id
  WHERE bk.payment_status='refunded' AND fe.source_type='order_paid' AND fe.is_reversed=false;
END;
$regen$;
