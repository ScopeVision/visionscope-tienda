
-- 1. Agreement type enum for assets
DO $$ BEGIN
  CREATE TYPE public.finance_agreement_type AS ENUM ('company_owned','split_70_30','custom_split','concession');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Asset agreement fields
ALTER TABLE public.finance_assets
  ADD COLUMN IF NOT EXISTS agreement_type public.finance_agreement_type,
  ADD COLUMN IF NOT EXISTS owner_split_pct numeric;

-- Backfill agreement_type from revenue_model
UPDATE public.finance_assets SET agreement_type =
  CASE revenue_model::text
    WHEN 'company_100' THEN 'company_owned'::public.finance_agreement_type
    WHEN 'split_70_30' THEN 'split_70_30'::public.finance_agreement_type
    WHEN 'custom'      THEN 'custom_split'::public.finance_agreement_type
    ELSE 'company_owned'::public.finance_agreement_type
  END
WHERE agreement_type IS NULL;

ALTER TABLE public.finance_assets ALTER COLUMN agreement_type SET NOT NULL;
ALTER TABLE public.finance_assets ALTER COLUMN agreement_type SET DEFAULT 'company_owned'::public.finance_agreement_type;

-- Backfill owner_split_pct
UPDATE public.finance_assets SET owner_split_pct =
  CASE agreement_type
    WHEN 'company_owned' THEN 0
    WHEN 'split_70_30'   THEN 70
    WHEN 'custom_split'  THEN COALESCE(100 - custom_company_pct, 70)
    WHEN 'concession'    THEN COALESCE(100 - custom_company_pct, 70)
  END
WHERE owner_split_pct IS NULL;

ALTER TABLE public.finance_assets ALTER COLUMN owner_split_pct SET NOT NULL;
ALTER TABLE public.finance_assets ALTER COLUMN owner_split_pct SET DEFAULT 0;
ALTER TABLE public.finance_assets ADD CONSTRAINT finance_assets_owner_split_pct_chk
  CHECK (owner_split_pct >= 0 AND owner_split_pct <= 100);

-- 3. Expense scope
DO $$ BEGIN
  CREATE TYPE public.finance_expense_scope AS ENUM ('company','asset','rental');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS scope public.finance_expense_scope NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS asset_id uuid,
  ADD COLUMN IF NOT EXISTS booking_id uuid;

-- 4. Update booking payment trigger to use agreement_type + owner_split_pct
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
  v_owner_pct numeric;
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
        v_owner_pct := COALESCE(v_asset.owner_split_pct, 0);
        v_company_pct := 100 - v_owner_pct;
        v_owner_id := v_asset.owner_id;
      END IF;

      v_company := ROUND(v_item.line_total * v_company_pct / 100.0, 2);
      v_payout  := ROUND(v_item.line_total - v_company, 2);

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
$function$;

-- 5. HARD-BLOCK equity validation
CREATE OR REPLACE FUNCTION public.validate_partner_equity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric;
BEGIN
  -- Compute total AFTER this op
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(SUM(profit_share_pct),0) INTO v_total
      FROM public.finance_partners WHERE id <> OLD.id;
  ELSE
    SELECT COALESCE(SUM(profit_share_pct),0) INTO v_total
      FROM public.finance_partners WHERE id <> NEW.id;
    v_total := v_total + COALESCE(NEW.profit_share_pct,0);
  END IF;

  IF ROUND(v_total::numeric, 4) <> 100 THEN
    RAISE EXCEPTION 'Equity distribution must equal 100%% before saving changes. Current total would be: %', v_total;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_partner_equity ON public.finance_partners;
CREATE CONSTRAINT TRIGGER trg_validate_partner_equity
  AFTER INSERT OR UPDATE OF profit_share_pct OR DELETE ON public.finance_partners
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.validate_partner_equity();

-- 6. Equity distribution view
CREATE OR REPLACE VIEW public.finance_equity_distribution
WITH (security_invoker = true)
AS
WITH dist AS (
  SELECT distributable FROM public.finance_summary(
    date_trunc('year', now()),
    date_trunc('year', now()) + interval '1 year'
  )
)
SELECT
  p.id AS partner_id,
  p.name,
  p.profit_share_pct AS equity_pct,
  d.distributable,
  ROUND(d.distributable * p.profit_share_pct / 100.0, 2) AS would_receive
FROM public.finance_partners p
CROSS JOIN dist d
ORDER BY p.sort_order, p.name;

-- 7. Audit triggers on remaining tables
DROP TRIGGER IF EXISTS trg_audit_finance_expenses ON public.finance_expenses;
CREATE TRIGGER trg_audit_finance_expenses
  AFTER UPDATE OR DELETE ON public.finance_expenses
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_finance_payout_payments ON public.finance_payout_payments;
CREATE TRIGGER trg_audit_finance_payout_payments
  AFTER UPDATE OR DELETE ON public.finance_payout_payments
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();
