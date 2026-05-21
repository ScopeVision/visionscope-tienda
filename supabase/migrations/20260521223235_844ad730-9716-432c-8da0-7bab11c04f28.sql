
CREATE TABLE IF NOT EXISTS public.booking_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  language text NOT NULL DEFAULT 'es',
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS booking_communications_booking_id_idx
  ON public.booking_communications(booking_id, created_at DESC);

ALTER TABLE public.booking_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read booking_communications"
  ON public.booking_communications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert booking_communications"
  ON public.booking_communications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update booking_communications"
  ON public.booking_communications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete booking_communications"
  ON public.booking_communications FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
