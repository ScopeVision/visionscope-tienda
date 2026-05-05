-- Fix: revoke bootstrap_first_admin from anonymous role
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid) FROM anon, public;
-- Keep authenticated grant (used by AdminSetup after sign-in)
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid) TO authenticated;

-- Tighten booking_items insert policy: only allow attaching items to a recently-created
-- booking that is still 'nuevo' (i.e., the same checkout session). This prevents
-- attaching items to arbitrary existing bookings by enumerating UUIDs.
DROP POLICY IF EXISTS "Anyone can create booking_items" ON public.booking_items;

CREATE POLICY "Anyone can create booking_items"
ON public.booking_items
FOR INSERT
TO public
WITH CHECK (
  quantity > 0 AND quantity <= 50
  AND days > 0 AND days <= 365
  AND subtotal >= 0
  AND char_length(product_name) BETWEEN 1 AND 300
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
      AND b.status = 'nuevo'::booking_status
      AND b.created_at > now() - interval '15 minutes'
  )
);