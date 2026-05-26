
-- =====================================================
-- ADVANCED RENTAL PRICING SYSTEM
-- =====================================================

-- 1. Enum pricing_model
DO $$ BEGIN
  CREATE TYPE public.pricing_model AS ENUM ('premium','aggressive','weekly_flat','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Products: pricing_model + multipliers (for custom)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pricing_model public.pricing_model NOT NULL DEFAULT 'premium',
  ADD COLUMN IF NOT EXISTS pricing_multipliers jsonb;

-- 3. Categories: default model used when assigning new products
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS default_pricing_model public.pricing_model NOT NULL DEFAULT 'premium';

-- 4. finance_settings: presets + day7 aggressive multiplier
ALTER TABLE public.finance_settings
  ADD COLUMN IF NOT EXISTS pricing_presets jsonb NOT NULL DEFAULT
    '{"premium":[1,1.6,2.25,2.8,3.3,3.7,4.0],"aggressive":[1,1.5,2.0,2.4,2.8,3.2,3.5]}'::jsonb,
  ADD COLUMN IF NOT EXISTS aggressive_day7_multiplier numeric NOT NULL DEFAULT 3.5;

INSERT INTO public.finance_settings (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;

-- 5. booking_items: audit columns for overrides
ALTER TABLE public.booking_items
  ADD COLUMN IF NOT EXISTS pricing_model text,
  ADD COLUMN IF NOT EXISTS auto_subtotal numeric,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS overridden_by uuid,
  ADD COLUMN IF NOT EXISTS overridden_at timestamptz;

-- 6. Helper: returns multipliers array (length 7) for given model
CREATE OR REPLACE FUNCTION public.get_pricing_multipliers(
  _model public.pricing_model,
  _custom jsonb,
  _price_day numeric,
  _price_week numeric
) RETURNS numeric[]
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_arr numeric[];
  v_weekly_factor numeric;
  v_day7 numeric;
BEGIN
  SELECT pricing_presets, aggressive_day7_multiplier INTO v_settings
  FROM public.finance_settings WHERE id = true LIMIT 1;

  IF _model = 'custom' AND _custom IS NOT NULL AND jsonb_array_length(_custom) >= 1 THEN
    SELECT ARRAY(SELECT (jsonb_array_elements_text(_custom))::numeric) INTO v_arr;
  ELSIF _model = 'premium' THEN
    SELECT ARRAY(SELECT (jsonb_array_elements_text(v_settings.pricing_presets->'premium'))::numeric) INTO v_arr;
  ELSIF _model = 'aggressive' THEN
    SELECT ARRAY(SELECT (jsonb_array_elements_text(v_settings.pricing_presets->'aggressive'))::numeric) INTO v_arr;
    v_day7 := COALESCE(v_settings.aggressive_day7_multiplier, 3.5);
    IF array_length(v_arr,1) >= 7 THEN v_arr[7] := v_day7; END IF;
  ELSIF _model = 'weekly_flat' THEN
    IF COALESCE(_price_week,0) > 0 AND COALESCE(_price_day,0) > 0 THEN
      v_weekly_factor := _price_week / _price_day;
      v_arr := ARRAY[1,2,3,4,5,6,v_weekly_factor]::numeric[];
    ELSE
      SELECT ARRAY(SELECT (jsonb_array_elements_text(v_settings.pricing_presets->'premium'))::numeric) INTO v_arr;
    END IF;
  ELSE
    SELECT ARRAY(SELECT (jsonb_array_elements_text(v_settings.pricing_presets->'premium'))::numeric) INTO v_arr;
  END IF;

  -- Pad/truncate to 7
  WHILE array_length(v_arr,1) IS NULL OR array_length(v_arr,1) < 7 LOOP
    v_arr := v_arr || ARRAY[COALESCE(v_arr[array_length(v_arr,1)], 1)]::numeric[];
  END LOOP;
  RETURN v_arr[1:7];
END;
$$;

-- 7. Helper: compute auto subtotal (per unit total)
CREATE OR REPLACE FUNCTION public.calc_rental_unit_total(
  _price_day numeric,
  _days int,
  _model public.pricing_model,
  _custom jsonb,
  _price_week numeric
) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arr numeric[];
  v_mult numeric;
BEGIN
  IF _days <= 0 THEN RETURN 0; END IF;
  IF _days > 7 THEN RETURN 0; END IF;
  v_arr := public.get_pricing_multipliers(_model, _custom, _price_day, _price_week);
  v_mult := v_arr[_days];
  RETURN ROUND(_price_day * COALESCE(v_mult,1), 2);
END;
$$;

-- 8. Update validate_booking_item_price to use product's model
CREATE OR REPLACE FUNCTION public.validate_booking_item_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_product record;
  v_unit_total numeric;
  v_auto_subtotal numeric;
  v_max_subtotal numeric;
  v_min_subtotal numeric;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.product_id IS NULL THEN
    RAISE EXCEPTION 'product_id is required';
  END IF;

  SELECT p.id, p.published, p.price_day, p.price_week, p.pricing_model, p.pricing_multipliers
    INTO v_product
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF NOT FOUND OR NOT v_product.published THEN
    RAISE EXCEPTION 'Product not found or unpublished';
  END IF;

  -- price_day must match product OR a variant
  IF NOT (
    ABS(NEW.price_day - v_product.price_day) <= 0.01
    OR EXISTS (
      SELECT 1 FROM public.product_variants v
      WHERE v.product_id = NEW.product_id
        AND ABS(NEW.price_day - v.price_day) <= 0.01
    )
  ) THEN
    RAISE EXCEPTION 'Invalid price_day for product';
  END IF;

  IF NEW.quantity <= 0 OR NEW.days <= 0 OR NEW.days > 7 THEN
    RAISE EXCEPTION 'Invalid quantity or days';
  END IF;

  v_unit_total := public.calc_rental_unit_total(
    NEW.price_day, NEW.days,
    v_product.pricing_model, v_product.pricing_multipliers, v_product.price_week
  );
  v_auto_subtotal := v_unit_total * NEW.quantity;
  v_max_subtotal := v_auto_subtotal + 0.01;
  v_min_subtotal := v_auto_subtotal * 0.55;

  IF NEW.subtotal < v_min_subtotal - 0.01 THEN
    RAISE EXCEPTION 'Subtotal too low (got %, min %)', NEW.subtotal, v_min_subtotal;
  END IF;
  IF NEW.subtotal > v_max_subtotal THEN
    RAISE EXCEPTION 'Subtotal too high (got %, max %)', NEW.subtotal, v_max_subtotal;
  END IF;

  -- Snapshot the pricing model and auto subtotal on the row
  NEW.pricing_model := v_product.pricing_model::text;
  IF NEW.auto_subtotal IS NULL THEN
    NEW.auto_subtotal := v_auto_subtotal;
  END IF;

  RETURN NEW;
END;
$function$;

-- 9. Update create_booking_with_items to use new pricing
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
  v_pricing_model public.pricing_model;
  v_pricing_multipliers jsonb;
  v_item_subtotal numeric;
  v_unit_total numeric;
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

    SELECT p.price_day, p.price_week, p.deposit, p.name_es, p.pricing_model, p.pricing_multipliers
      INTO v_price_day, v_price_week, v_deposit, v_product_name, v_pricing_model, v_pricing_multipliers
    FROM public.products p WHERE p.id = v_product_id AND p.published = true;

    IF v_product_name IS NULL THEN RAISE EXCEPTION 'product not found or not published'; END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT v.price_day, COALESCE(v.price_week, v_price_week), v.deposit
        INTO v_price_day, v_price_week, v_deposit
      FROM public.product_variants v
      WHERE v.id = v_variant_id AND v.product_id = v_product_id;
    END IF;

    v_unit_total := public.calc_rental_unit_total(v_price_day, v_days, v_pricing_model, v_pricing_multipliers, v_price_week);
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

    SELECT p.price_day, p.price_week, p.deposit, p.name_es, p.pricing_model, p.pricing_multipliers
      INTO v_price_day, v_price_week, v_deposit, v_product_name, v_pricing_model, v_pricing_multipliers
    FROM public.products p WHERE p.id = v_product_id AND p.published = true;

    IF v_variant_id IS NOT NULL THEN
      SELECT v.price_day, COALESCE(v.price_week, v_price_week), v.deposit
        INTO v_price_day, v_price_week, v_deposit
      FROM public.product_variants v
      WHERE v.id = v_variant_id AND v.product_id = v_product_id;
    END IF;

    v_unit_total := public.calc_rental_unit_total(v_price_day, v_days, v_pricing_model, v_pricing_multipliers, v_price_week);
    v_item_subtotal := v_unit_total * v_quantity;

    INSERT INTO public.booking_items
      (booking_id, product_id, variant_id, product_name, quantity, days, price_day, price_week, deposit,
       subtotal, auto_subtotal, pricing_model)
    VALUES
      (v_booking_id, v_product_id, v_variant_id, v_product_name, v_quantity, v_days,
       v_price_day, v_price_week, v_deposit,
       v_item_subtotal, v_item_subtotal, v_pricing_model::text);
  END LOOP;

  RETURN QUERY SELECT v_booking_id, v_reference;
END;
$function$;
