
-- 1. Lock down bootstrap_first_admin to authenticated only
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid) TO authenticated;

-- 2. Remove public INSERT policies on bookings/booking_items (force RPC path)
DROP POLICY IF EXISTS "Anyone can create booking" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create booking_items" ON public.booking_items;

-- 3. Server-side booking creation function
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
SET search_path = public
AS $$
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
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'no items'; END IF;
  IF jsonb_array_length(_items) > 100 THEN RAISE EXCEPTION 'too many items'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = _customer_id) THEN
    RAISE EXCEPTION 'customer not found';
  END IF;

  v_days := GREATEST(1, (_end_date - _start_date) + 1);

  -- Validate / compute totals server-side
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

    -- Weekly pricing logic mirrors src/lib/rental.ts
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

    -- Stash the computed values back for insertion phase
    v_item := v_item
      || jsonb_build_object(
        'price_day', v_price_day,
        'price_week', v_price_week,
        'deposit', v_deposit,
        'subtotal', v_item_subtotal,
        'product_name', v_product_name,
        'days', v_days
      );
  END LOOP;

  -- Recompute fully in second pass to insert items with validated values
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
$$;

REVOKE EXECUTE ON FUNCTION public.create_booking_with_items(uuid, date, date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_with_items(uuid, date, date, text, jsonb) TO anon, authenticated;
