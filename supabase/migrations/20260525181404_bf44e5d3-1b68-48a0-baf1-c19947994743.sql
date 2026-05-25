ALTER TYPE public.finance_payout_status ADD VALUE IF NOT EXISTS 'unpaid';
ALTER TYPE public.finance_payout_status ADD VALUE IF NOT EXISTS 'partially_paid';