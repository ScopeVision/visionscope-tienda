
-- 1. site_settings: restrict SELECT to admins
DROP POLICY IF EXISTS "Public read site_settings" ON public.site_settings;
CREATE POLICY "Admins read site_settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. customers: tighten guest INSERT policy with length limits
DROP POLICY IF EXISTS "Anyone can create customer" ON public.customers;
CREATE POLICY "Anyone can create customer"
ON public.customers
FOR INSERT
TO public
WITH CHECK (
  char_length(email) BETWEEN 3 AND 255
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND char_length(full_name) BETWEEN 1 AND 200
  AND (phone IS NULL OR char_length(phone) <= 40)
  AND (company IS NULL OR char_length(company) <= 200)
  AND (tax_id IS NULL OR char_length(tax_id) <= 40)
  AND (address_line1 IS NULL OR char_length(address_line1) <= 200)
  AND (address_line2 IS NULL OR char_length(address_line2) <= 200)
  AND (city IS NULL OR char_length(city) <= 100)
  AND (postal_code IS NULL OR char_length(postal_code) <= 20)
  AND (country IS NULL OR char_length(country) <= 100)
  AND (notes IS NULL OR char_length(notes) <= 2000)
);

-- 3. create_booking_with_items: cap booking window
CREATE OR REPLACE FUNCTION public.create_booking_with_items(_customer_id uuid, _start_date date, _end_date date, _notes text, _items jsonb)
 RETURNS TABLE(booking_id uuid, reference text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_days int;
  v_subtotal numeric := 0;
  v_deposit_total numeric := 0;
  v_booking_id uuid;
  v_reference text;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity int;
  v_price_day numeric;
  v_price_week numeric;
  v_deposit numeric;
  v_product_name text;
  v_item_subtotal numeric;
  v_weeks int;
  v_rem_days int;
  v_rem_cost numeric;
BEGIN
  IF _customer_id IS NULL THEN RAISE EXCEPTION 'customer_id required'; END IF;
  IF _start_date IS NULL OR _end_date IS NULL THEN RAISE EXCEPTION 'dates required'; END IF;
  IF _start_date > _end_date THEN RAISE EXCEPTION 'invalid date range'; END IF;
  IF _start_date < CURRENT_DATE - INTERVAL '1 day' THEN RAISE EXCEPTION 'start_date in the past'; END IF;
  IF _end_date > CURRENT_DATE + INTERVAL '2 years' THEN RAISE EXCEPTION 'end_date exceeds maximum allowed rental window'; END IF;
  IF (_end_date - _start_date) + 1 > 365 THEN RAISE EXCEPTION 'rental duration exceeds 365 days'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'no items'; END IF;
  IF jsonb_array_length(_items) > 100 THEN RAISE EXCEPTION 'too many items'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = _customer_id) THEN
    RAISE EXCEPTION 'customer not found';
  END IF;

  v_days := GREATEST(1, (_end_date - _start_date) + 1);

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::int, 0);

    IF v_quantity <= 0 OR v_quantity > 50 THEN RAISE EXCEPTION 'invalid quantity'; END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT v.price_day, v.price_week, v.deposit, p.name_es
        INTO v_price_day, v_price_week, v_deposit, v_product_name
      FROM public.product_variants v
      JOIN public.products p ON p.id = v.product_id
      WHERE v.id = v_variant_id AND v.product_id = v_product_id AND p.published = true;
    ELSE
      SELECT p.price_day, p.price_week, p.deposit, p.name_es
        INTO v_price_day, v_price_week, v_deposit, v_product_name
      FROM public.products p
      WHERE p.id = v_product_id AND p.published = true;
    END IF;

    IF v_product_name IS NULL THEN RAISE EXCEPTION 'product not found or not published'; END IF;

    IF v_price_week IS NULL OR v_days < 7 THEN
      v_item_subtotal := v_price_day * v_days * v_quantity;
    ELSE
      v_weeks := v_days / 7;
      v_rem_days := v_days - v_weeks * 7;
      v_rem_cost := LEAST(v_rem_days * v_price_day, v_price_week);
      v_item_subtotal := (v_weeks * v_price_week + v_rem_cost) * v_quantity;
    END IF;

    v_subtotal := v_subtotal + v_item_subtotal;
    v_deposit_total := v_deposit_total + v_deposit * v_quantity;
  END LOOP;

  INSERT INTO public.bookings (customer_id, start_date, end_date, status, subtotal, deposit_total, total, notes)
  VALUES (_customer_id, _start_date, _end_date, 'nuevo'::booking_status, v_subtotal, v_deposit_total, v_subtotal,
          NULLIF(LEFT(COALESCE(_notes, ''), 2000), ''))
  RETURNING id, public.bookings.reference INTO v_booking_id, v_reference;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::int;

    IF v_variant_id IS NOT NULL THEN
      SELECT v.price_day, v.price_week, v.deposit, p.name_es
        INTO v_price_day, v_price_week, v_deposit, v_product_name
      FROM public.product_variants v
      JOIN public.products p ON p.id = v.product_id
      WHERE v.id = v_variant_id AND v.product_id = v_product_id AND p.published = true;
    ELSE
      SELECT p.price_day, p.price_week, p.deposit, p.name_es
        INTO v_price_day, v_price_week, v_deposit, v_product_name
      FROM public.products p
      WHERE p.id = v_product_id AND p.published = true;
    END IF;

    IF v_price_week IS NULL OR v_days < 7 THEN
      v_item_subtotal := v_price_day * v_days * v_quantity;
    ELSE
      v_weeks := v_days / 7;
      v_rem_days := v_days - v_weeks * 7;
      v_rem_cost := LEAST(v_rem_days * v_price_day, v_price_week);
      v_item_subtotal := (v_weeks * v_price_week + v_rem_cost) * v_quantity;
    END IF;

    INSERT INTO public.booking_items
      (booking_id, product_id, product_name, quantity, days, price_day, price_week, deposit, subtotal)
    VALUES
      (v_booking_id, v_product_id, v_product_name, v_quantity, v_days,
       v_price_day, v_price_week, v_deposit, v_item_subtotal);
  END LOOP;

  RETURN QUERY SELECT v_booking_id, v_reference;
END;
$function$;
