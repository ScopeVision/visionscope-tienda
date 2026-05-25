-- 1. Partial payments table
CREATE TABLE public.finance_payout_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.finance_payouts(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL DEFAULT now(),
  method text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payout_payments_payout ON public.finance_payout_payments(payout_id);

ALTER TABLE public.finance_payout_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage finance_payout_payments"
ON public.finance_payout_payments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER finance_payout_payments_audit
AFTER UPDATE OR DELETE ON public.finance_payout_payments
FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

-- 2. paid_amount column
ALTER TABLE public.finance_payouts
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

-- 3. Recompute status function
CREATE OR REPLACE FUNCTION public.recompute_payout_status(_payout_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_amount numeric;
  v_paid numeric;
  v_status finance_payout_status;
  v_current_status finance_payout_status;
BEGIN
  SELECT amount, status INTO v_amount, v_current_status
  FROM public.finance_payouts WHERE id = _payout_id;

  IF v_current_status = 'cancelled' THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.finance_payout_payments WHERE payout_id = _payout_id;

  IF v_paid <= 0 THEN v_status := 'unpaid';
  ELSIF v_paid + 0.01 < v_amount THEN v_status := 'partially_paid';
  ELSE v_status := 'paid';
  END IF;

  UPDATE public.finance_payouts
  SET paid_amount = v_paid,
      status = v_status,
      paid_at = CASE WHEN v_status = 'paid' THEN COALESCE(paid_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = _payout_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_payout_payment_refresh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_payout_status(COALESCE(NEW.payout_id, OLD.payout_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER finance_payout_payments_refresh
AFTER INSERT OR UPDATE OR DELETE ON public.finance_payout_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_payout_payment_refresh();

-- 4. Migrate existing pending → unpaid
UPDATE public.finance_payouts SET status = 'unpaid'::finance_payout_status WHERE status = 'pending'::finance_payout_status;

-- 5. Booking trigger uses 'unpaid'
CREATE OR REPLACE FUNCTION public.handle_booking_payment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
      SELECT bi.*, bi.subtotal AS line_total FROM public.booking_items bi WHERE bi.booking_id = NEW.id
    LOOP
      SELECT * INTO v_asset FROM public.finance_assets WHERE product_id = v_item.product_id AND active = true LIMIT 1;

      IF v_asset.id IS NULL THEN
        v_company_pct := v_default_pct; v_owner_id := NULL;
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
         v_item.line_total, v_company, v_payout, v_company_pct, now(),
         'Auto: ' || NEW.reference || ' / ' || v_item.product_name, 'active')
      RETURNING id INTO v_entry_id;

      IF v_payout > 0 THEN
        INSERT INTO public.finance_payouts
          (asset_id, entry_id, owner_id, owner_label, amount, applied_pct, status, notes, paid_amount)
        VALUES
          (v_asset.id, v_entry_id, v_owner_id,
           COALESCE((SELECT name FROM public.finance_owners WHERE id = v_owner_id), v_asset.owner_label),
           v_payout, 100 - v_company_pct, 'unpaid',
           'Auto from booking ' || NEW.reference, 0);
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
      AND status IN ('unpaid','partially_paid','pending');

    IF NEW.refunded_at IS NULL THEN NEW.refunded_at := now(); END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Updated finance_summary
DROP FUNCTION IF EXISTS public.finance_summary(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.finance_summary(_start timestamptz, _end timestamptz)
RETURNS TABLE(
  rental_income numeric, store_income numeric, services_income numeric,
  payouts_paid numeric, payouts_pending numeric, payouts_partial numeric,
  owner_liability_open numeric,
  expenses_total numeric, debt_repaid numeric,
  cash_balance numeric, cash_reserve_target numeric, distributable numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH
    inc AS (
      SELECT
        COALESCE(SUM(company_amount) FILTER (WHERE origin_system='rental'   AND status='active'), 0) AS rental_income,
        COALESCE(SUM(company_amount) FILTER (WHERE origin_system='store'    AND status='active'), 0) AS store_income,
        COALESCE(SUM(company_amount) FILTER (WHERE origin_system='services' AND status='active'), 0) AS services_income
      FROM public.finance_entries
      WHERE occurred_at >= _start AND occurred_at < _end
    ),
    po AS (
      SELECT
        COALESCE(SUM(paid_amount), 0) AS payouts_paid_total,
        COALESCE(SUM(amount - paid_amount) FILTER (WHERE status IN ('unpaid','partially_paid','pending')), 0) AS payouts_pending_total,
        COALESCE(SUM(paid_amount) FILTER (WHERE status='partially_paid'), 0) AS payouts_partial_total
      FROM public.finance_payouts
    ),
    ex AS (
      SELECT COALESCE(SUM(amount), 0) AS expenses_total
      FROM public.finance_expenses
      WHERE occurred_at >= _start AND occurred_at < _end
    ),
    dr AS (
      SELECT COALESCE(SUM(amount), 0) AS debt_repaid
      FROM public.finance_debt_repayments
      WHERE paid_at >= _start AND paid_at < _end
    ),
    cash AS (
      SELECT
        COALESCE((SELECT SUM(company_amount) FROM public.finance_entries WHERE status='active'), 0)
        - COALESCE((SELECT SUM(amount) FROM public.finance_expenses), 0)
        - COALESCE((SELECT SUM(amount) FROM public.finance_debt_repayments), 0)
        AS cash_balance
    ),
    res AS (
      SELECT COALESCE(target_amount, 0) AS cash_reserve_target FROM public.finance_cash_reserve WHERE id = true
    )
  SELECT
    inc.rental_income, inc.store_income, inc.services_income,
    po.payouts_paid_total, po.payouts_pending_total, po.payouts_partial_total,
    po.payouts_pending_total AS owner_liability_open,
    ex.expenses_total, dr.debt_repaid,
    cash.cash_balance,
    COALESCE(res.cash_reserve_target, 0),
    (inc.rental_income + inc.store_income + inc.services_income)
      - ex.expenses_total - COALESCE(res.cash_reserve_target, 0) AS distributable
  FROM inc, po, ex, dr, cash LEFT JOIN res ON true;
$$;

-- 7. Asset KPIs view
CREATE OR REPLACE VIEW public.finance_asset_kpis AS
SELECT
  a.id AS asset_id, a.name, a.owner_id, a.target_recovery_value, a.transition_status,
  COALESCE(SUM(e.gross_amount)   FILTER (WHERE e.status='active'), 0) AS gross_revenue,
  COALESCE(SUM(e.company_amount) FILTER (WHERE e.status='active'), 0) AS company_revenue,
  COALESCE(SUM(e.payout_amount)  FILTER (WHERE e.status='active'), 0) AS owner_revenue,
  COALESCE(SUM(e.company_amount + e.payout_amount) FILTER (WHERE e.status='active'), 0) AS recovered_value,
  CASE WHEN a.target_recovery_value > 0
    THEN LEAST(100, ROUND(
      COALESCE(SUM(e.company_amount + e.payout_amount) FILTER (WHERE e.status='active'), 0)
      / a.target_recovery_value * 100, 2))
    ELSE 0 END AS recovery_pct,
  CASE WHEN a.target_recovery_value > 0
    AND COALESCE(SUM(e.company_amount + e.payout_amount) FILTER (WHERE e.status='active'), 0) >= a.target_recovery_value
    THEN true ELSE false END AS target_reached
FROM public.finance_assets a
LEFT JOIN public.finance_entries e ON e.asset_id = a.id
GROUP BY a.id;

GRANT SELECT ON public.finance_asset_kpis TO authenticated;

-- 8. Owner balances view
CREATE OR REPLACE VIEW public.finance_owner_balances AS
SELECT
  o.id AS owner_id, o.name, o.type, o.active,
  COALESCE((SELECT SUM(e.gross_amount) FROM public.finance_entries e WHERE e.owner_id = o.id AND e.status='active'), 0) AS total_generated_gross,
  COALESCE((SELECT SUM(p.amount) FROM public.finance_payouts p WHERE p.owner_id = o.id AND p.status <> 'cancelled'), 0) AS total_owed,
  COALESCE((SELECT SUM(p.paid_amount) FROM public.finance_payouts p WHERE p.owner_id = o.id AND p.status <> 'cancelled'), 0) AS total_paid,
  COALESCE((SELECT SUM(p.amount - p.paid_amount) FROM public.finance_payouts p WHERE p.owner_id = o.id AND p.status IN ('unpaid','partially_paid','pending')), 0) AS remaining_unpaid
FROM public.finance_owners o;

GRANT SELECT ON public.finance_owner_balances TO authenticated;