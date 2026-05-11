
-- Replace booking creation with progressive daily discount pricing.
CREATE OR REPLACE FUNCTION public.create_booking_with_items(
  _customer_id uuid,
  _start_date date,
  _end_date date,
  _notes text,
  _items jsonb
)
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
  v_unit_total numeric;
  v_n int;
BEGIN
  IF _customer_id IS NULL THEN RAISE EXCEPTION 'customer_id required'; END IF;
  IF _start_date IS NULL OR _end_date IS NULL THEN RAISE EXCEPTION 'dates required'; END IF;
  IF _start_date > _end_date THEN RAISE EXCEPTION 'invalid date range'; END IF;
  IF _start_date < CURRENT_DATE - INTERVAL '1 day' THEN RAISE EXCEPTION 'start_date in the past'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'no items'; END IF;
  IF jsonb_array_length(_items) > 100 THEN RAISE EXCEPTION 'too many items'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = _customer_id) THEN
    RAISE EXCEPTION 'customer not found';
  END IF;

  v_days := GREATEST(1, (_end_date - _start_date) + 1);

  IF v_days > 7 THEN
    RAISE EXCEPTION 'For rentals of 8 days or more, please contact us.';
  END IF;

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

    -- Progressive daily discount: day n cost = price_day * (1 - 0.06 * (n - 1))
    v_unit_total := 0;
    FOR v_n IN 1..v_days LOOP
      v_unit_total := v_unit_total + v_price_day * GREATEST(0, 1 - 0.06 * (v_n - 1));
    END LOOP;
    v_item_subtotal := v_unit_total * v_quantity;

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

    v_unit_total := 0;
    FOR v_n IN 1..v_days LOOP
      v_unit_total := v_unit_total + v_price_day * GREATEST(0, 1 - 0.06 * (v_n - 1));
    END LOOP;
    v_item_subtotal := v_unit_total * v_quantity;

    INSERT INTO public.booking_items
      (booking_id, product_id, product_name, quantity, days, price_day, price_week, deposit, subtotal)
    VALUES
      (v_booking_id, v_product_id, v_product_name, v_quantity, v_days,
       v_price_day, v_price_week, v_deposit, v_item_subtotal);
  END LOOP;

  RETURN QUERY SELECT v_booking_id, v_reference;
END;
$function$;

-- Relax the price validation trigger to accept the progressive subtotal.
-- 7-day total = 5.74 * price_day  → ratio 0.82. We keep a 0.55 floor for safety.
CREATE OR REPLACE FUNCTION public.validate_booking_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  valid_price_day boolean;
  min_subtotal numeric;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.product_id IS NULL THEN
    RAISE EXCEPTION 'product_id is required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = NEW.product_id
      AND p.published = true
      AND ABS(NEW.price_day - p.price_day) <= 0.01
    UNION ALL
    SELECT 1 FROM public.product_variants v
    WHERE v.product_id = NEW.product_id
      AND ABS(NEW.price_day - v.price_day) <= 0.01
  ) INTO valid_price_day;

  IF NOT valid_price_day THEN
    RAISE EXCEPTION 'Invalid price_day for product';
  END IF;

  IF NEW.quantity <= 0 OR NEW.days <= 0 THEN
    RAISE EXCEPTION 'Invalid quantity or days';
  END IF;

  min_subtotal := NEW.price_day * NEW.days * NEW.quantity * 0.55;
  IF NEW.subtotal < min_subtotal - 0.01 THEN
    RAISE EXCEPTION 'Subtotal too low (got %, min %)', NEW.subtotal, min_subtotal;
  END IF;

  IF NEW.subtotal > NEW.price_day * NEW.days * NEW.quantity + 0.01 THEN
    RAISE EXCEPTION 'Subtotal too high';
  END IF;

  RETURN NEW;
END;
$function$;
