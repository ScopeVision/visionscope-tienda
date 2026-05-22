
-- =========================================================================
-- FINANCE CORE SYSTEM V3
-- =========================================================================

-- Enums
CREATE TYPE public.finance_origin_type AS ENUM ('socio', 'concession', 'external', 'company');
CREATE TYPE public.finance_revenue_model AS ENUM ('split_70_30', 'company_100', 'custom');
CREATE TYPE public.finance_transition_status AS ENUM ('normal', 'in_transition', 'transferred');
CREATE TYPE public.finance_origin_system AS ENUM ('rental', 'store', 'services');
CREATE TYPE public.finance_source_type AS ENUM (
  'order_paid', 'refund', 'manual_adjustment', 'expense', 'debt_repayment', 'payout'
);
CREATE TYPE public.finance_payout_status AS ENUM ('pending', 'paid', 'cancelled');

-- Add 'refunded' to payment_status enum (if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'payment_status' AND e.enumlabel = 'refunded'
  ) THEN
    ALTER TYPE public.payment_status ADD VALUE 'refunded';
  END IF;
END $$;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

-- =========================================================================
-- TABLES
-- =========================================================================

CREATE TABLE public.finance_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  origin_type public.finance_origin_type NOT NULL DEFAULT 'company',
  owner_label text,
  revenue_model public.finance_revenue_model NOT NULL DEFAULT 'company_100',
  custom_company_pct numeric(5,2),
  acquisition_value numeric(12,2) NOT NULL DEFAULT 0,
  transition_status public.finance_transition_status NOT NULL DEFAULT 'normal',
  product_id uuid,
  store_product_id uuid,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_assets_product ON public.finance_assets(product_id);
CREATE INDEX idx_finance_assets_store_product ON public.finance_assets(store_product_id);

CREATE TABLE public.finance_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  profit_share_pct numeric(5,2) NOT NULL DEFAULT 0,
  initial_debt numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_system public.finance_origin_system NOT NULL,
  source_type public.finance_source_type NOT NULL,
  booking_id uuid,
  store_order_id uuid,
  asset_id uuid REFERENCES public.finance_assets(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES public.finance_partners(id) ON DELETE SET NULL,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  company_amount numeric(12,2) NOT NULL DEFAULT 0,
  payout_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  is_reversed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_entries_booking ON public.finance_entries(booking_id);
CREATE INDEX idx_finance_entries_occurred ON public.finance_entries(occurred_at);
CREATE INDEX idx_finance_entries_origin ON public.finance_entries(origin_system, source_type);

CREATE TABLE public.finance_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.finance_assets(id) ON DELETE SET NULL,
  entry_id uuid REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  owner_label text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status public.finance_payout_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_payouts_status ON public.finance_payouts(status);

CREATE TABLE public.finance_debt_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.finance_partners(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general',
  description text,
  amount numeric(12,2) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_cash_reserve (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  target_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- RLS
-- =========================================================================

ALTER TABLE public.finance_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_debt_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_cash_reserve ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'finance_assets','finance_partners','finance_entries','finance_payouts',
    'finance_debt_repayments','finance_expenses','finance_cash_reserve'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "Admins manage %I" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::app_role));',
      t, t
    );
  END LOOP;
END $$;

-- updated_at triggers
CREATE TRIGGER trg_finance_assets_updated BEFORE UPDATE ON public.finance_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_finance_partners_updated BEFORE UPDATE ON public.finance_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_finance_payouts_updated BEFORE UPDATE ON public.finance_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- CORE LOGIC: booking paid / refunded
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_booking_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_asset record;
  v_company_pct numeric;
  v_company numeric;
  v_payout numeric;
  v_entry_id uuid;
  v_owner text;
BEGIN
  -- PAID: only on transition into paid
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
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
        v_company_pct := 100;
        v_owner := NULL;
      ELSE
        v_company_pct := CASE v_asset.revenue_model
          WHEN 'company_100' THEN 100
          WHEN 'split_70_30' THEN 30
          WHEN 'custom' THEN COALESCE(v_asset.custom_company_pct, 100)
        END;
        v_owner := v_asset.owner_label;
      END IF;

      v_company := ROUND(v_item.line_total * v_company_pct / 100.0, 2);
      v_payout := ROUND(v_item.line_total - v_company, 2);

      INSERT INTO public.finance_entries
        (origin_system, source_type, booking_id, asset_id, gross_amount, company_amount, payout_amount, occurred_at, notes)
      VALUES
        ('rental', 'order_paid', NEW.id, v_asset.id, v_item.line_total, v_company, v_payout, now(),
         'Auto: booking ' || NEW.reference || ' / ' || v_item.product_name)
      RETURNING id INTO v_entry_id;

      IF v_payout > 0 THEN
        INSERT INTO public.finance_payouts
          (asset_id, entry_id, owner_label, amount, status, notes)
        VALUES
          (v_asset.id, v_entry_id, v_owner, v_payout, 'pending',
           'Auto from booking ' || NEW.reference);
      END IF;
    END LOOP;
  END IF;

  -- REFUNDED
  IF NEW.payment_status = 'refunded' AND (OLD.payment_status IS DISTINCT FROM 'refunded') THEN
    -- Reverse all entries for this booking
    INSERT INTO public.finance_entries
      (origin_system, source_type, booking_id, asset_id, gross_amount, company_amount, payout_amount, occurred_at, notes, is_reversed)
    SELECT origin_system, 'refund', booking_id, asset_id,
           -gross_amount, -company_amount, -payout_amount, now(),
           'Refund of booking ' || NEW.reference, false
    FROM public.finance_entries
    WHERE booking_id = NEW.id AND source_type = 'order_paid' AND is_reversed = false;

    UPDATE public.finance_entries
    SET is_reversed = true
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
$$;

CREATE TRIGGER trg_booking_payment_change
AFTER UPDATE OF payment_status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.handle_booking_payment_change();

-- =========================================================================
-- DISTRIBUTABLE PROFIT (for a date range)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_summary(_start timestamptz, _end timestamptz)
RETURNS TABLE(
  rental_income numeric,
  store_income numeric,
  services_income numeric,
  payouts_paid numeric,
  payouts_pending numeric,
  expenses_total numeric,
  debt_repaid numeric,
  cash_balance numeric,
  cash_reserve_target numeric,
  distributable numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH
    inc AS (
      SELECT
        COALESCE(SUM(company_amount) FILTER (WHERE origin_system='rental'   AND source_type IN ('order_paid','refund','manual_adjustment')), 0) AS rental_income,
        COALESCE(SUM(company_amount) FILTER (WHERE origin_system='store'    AND source_type IN ('order_paid','refund','manual_adjustment')), 0) AS store_income,
        COALESCE(SUM(company_amount) FILTER (WHERE origin_system='services' AND source_type IN ('order_paid','refund','manual_adjustment')), 0) AS services_income
      FROM public.finance_entries
      WHERE occurred_at >= _start AND occurred_at < _end
    ),
    po AS (
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE status='paid'    AND paid_at >= _start AND paid_at < _end), 0) AS payouts_paid,
        COALESCE(SUM(amount) FILTER (WHERE status='pending'), 0) AS payouts_pending
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
      SELECT COALESCE(SUM(company_amount), 0)
             - COALESCE((SELECT SUM(amount) FROM public.finance_payouts WHERE status='paid'), 0)
             - COALESCE((SELECT SUM(amount) FROM public.finance_expenses), 0)
             - COALESCE((SELECT SUM(amount) FROM public.finance_debt_repayments), 0)
             AS cash_balance
      FROM public.finance_entries
    ),
    res AS (
      SELECT COALESCE(target_amount, 0) AS cash_reserve_target
      FROM public.finance_cash_reserve WHERE id = true
    )
  SELECT
    inc.rental_income,
    inc.store_income,
    inc.services_income,
    po.payouts_paid,
    po.payouts_pending,
    ex.expenses_total,
    dr.debt_repaid,
    cash.cash_balance,
    COALESCE(res.cash_reserve_target, 0),
    (inc.rental_income + inc.store_income + inc.services_income)
      - po.payouts_paid - ex.expenses_total - dr.debt_repaid - COALESCE(res.cash_reserve_target, 0)
      AS distributable
  FROM inc, po, ex, dr, cash LEFT JOIN res ON true;
$$;

-- =========================================================================
-- SEED
-- =========================================================================

INSERT INTO public.finance_partners (name, profit_share_pct, initial_debt, sort_order)
VALUES
  ('Socio A', 40, 684, 1),
  ('Socio B', 40, 1200, 2),
  ('Socio C', 20, 0, 3);

INSERT INTO public.finance_cash_reserve (id, target_amount) VALUES (true, 0);
