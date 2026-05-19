-- Payment status enum
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'deposit_pending', 'partially_paid', 'paid', 'refunded');

-- Extend booking_status enum
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'awaiting_confirmation';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'ready_for_pickup';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'returned';

-- bookings: new columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none','fixed','percent')),
  ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_fees jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal_override numeric,
  ADD COLUMN IF NOT EXISTS total_override numeric,
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- booking_items: new columns
ALTER TABLE public.booking_items
  ADD COLUMN IF NOT EXISTS variant_id uuid,
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none','fixed','percent')),
  ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_override numeric;

-- Allow admins to INSERT bookings and booking_items directly
CREATE POLICY "Admins insert bookings"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert booking_items"
  ON public.booking_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Audit log
CREATE TABLE public.booking_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_audit_log_booking ON public.booking_audit_log(booking_id, created_at DESC);

ALTER TABLE public.booking_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log"
  ON public.booking_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert audit log"
  ON public.booking_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));