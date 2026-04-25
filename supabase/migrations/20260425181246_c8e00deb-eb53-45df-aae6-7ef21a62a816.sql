
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Tighten public INSERT policies
DROP POLICY "Anyone can create customer" ON public.customers;
CREATE POLICY "Anyone can create customer" ON public.customers FOR INSERT
  WITH CHECK (
    char_length(email) BETWEEN 3 AND 255
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND char_length(full_name) BETWEEN 1 AND 200
  );

DROP POLICY "Anyone can create booking" ON public.bookings;
CREATE POLICY "Anyone can create booking" ON public.bookings FOR INSERT
  WITH CHECK (
    status = 'nuevo'
    AND start_date <= end_date
    AND start_date >= current_date - interval '1 day'
    AND total >= 0
    AND deposit_total >= 0
    AND subtotal >= 0
  );

DROP POLICY "Anyone can create booking_items" ON public.booking_items;
CREATE POLICY "Anyone can create booking_items" ON public.booking_items FOR INSERT
  WITH CHECK (
    quantity > 0 AND quantity <= 50
    AND days > 0 AND days <= 365
    AND subtotal >= 0
    AND char_length(product_name) BETWEEN 1 AND 300
  );

-- Restrict storage bucket listing to admins; individual file URLs remain public
DROP POLICY "Public read product images" ON storage.objects;
CREATE POLICY "Admins list product images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
-- Individual public access works via the public bucket's signed/public URL, no SELECT policy needed for anon
