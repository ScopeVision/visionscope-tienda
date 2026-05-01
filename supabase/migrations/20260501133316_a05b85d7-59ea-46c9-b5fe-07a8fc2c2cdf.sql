-- Validation trigger for booking_items: recalculate subtotal from actual product price
CREATE OR REPLACE FUNCTION public.validate_booking_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prod_price_day numeric;
  prod_price_week numeric;
  prod_deposit numeric;
  expected_subtotal numeric;
  weeks integer;
  remainder integer;
BEGIN
  -- Skip validation for admins (they manage bookings manually)
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- product_id is required for validation
  IF NEW.product_id IS NULL THEN
    RAISE EXCEPTION 'product_id is required for booking items';
  END IF;

  SELECT price_day, price_week, deposit
    INTO prod_price_day, prod_price_week, prod_deposit
  FROM public.products
  WHERE id = NEW.product_id AND published = true;

  IF prod_price_day IS NULL THEN
    RAISE EXCEPTION 'Product not found or not available';
  END IF;

  -- Submitted unit prices must match the product's actual prices
  IF ABS(COALESCE(NEW.price_day, 0) - prod_price_day) > 0.01 THEN
    RAISE EXCEPTION 'Price mismatch: invalid price_day';
  END IF;

  IF NEW.price_week IS NOT NULL AND prod_price_week IS NOT NULL
     AND ABS(NEW.price_week - prod_price_week) > 0.01 THEN
    RAISE EXCEPTION 'Price mismatch: invalid price_week';
  END IF;

  IF ABS(COALESCE(NEW.deposit, 0) - (prod_deposit * NEW.quantity)) > 0.01 THEN
    RAISE EXCEPTION 'Price mismatch: invalid deposit';
  END IF;

  -- Recalculate expected subtotal: weekly rate when applicable, otherwise daily
  IF prod_price_week IS NOT NULL AND NEW.days >= 7 THEN
    weeks := NEW.days / 7;
    remainder := NEW.days % 7;
    expected_subtotal := (weeks * prod_price_week + remainder * prod_price_day) * NEW.quantity;
  ELSE
    expected_subtotal := prod_price_day * NEW.days * NEW.quantity;
  END IF;

  IF ABS(COALESCE(NEW.subtotal, 0) - expected_subtotal) > 0.01 THEN
    RAISE EXCEPTION 'Price mismatch: invalid subtotal (expected %, got %)', expected_subtotal, NEW.subtotal;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_booking_item_price ON public.booking_items;
CREATE TRIGGER trg_validate_booking_item_price
BEFORE INSERT OR UPDATE ON public.booking_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_item_price();

-- Validation trigger for bookings: recalculate totals from booking_items
CREATE OR REPLACE FUNCTION public.validate_booking_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected_subtotal numeric;
  expected_deposit numeric;
  expected_total numeric;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(subtotal), 0), COALESCE(SUM(deposit), 0)
    INTO expected_subtotal, expected_deposit
  FROM public.booking_items
  WHERE booking_id = NEW.id;

  expected_total := expected_subtotal;

  IF ABS(COALESCE(NEW.subtotal, 0) - expected_subtotal) > 0.01 THEN
    RAISE EXCEPTION 'Booking subtotal mismatch (expected %, got %)', expected_subtotal, NEW.subtotal;
  END IF;
  IF ABS(COALESCE(NEW.deposit_total, 0) - expected_deposit) > 0.01 THEN
    RAISE EXCEPTION 'Booking deposit mismatch (expected %, got %)', expected_deposit, NEW.deposit_total;
  END IF;
  IF ABS(COALESCE(NEW.total, 0) - expected_total) > 0.01 THEN
    RAISE EXCEPTION 'Booking total mismatch (expected %, got %)', expected_total, NEW.total;
  END IF;

  RETURN NEW;
END;
$$;

-- Validate after booking items are inserted (deferred check via update on booking)
DROP TRIGGER IF EXISTS trg_validate_booking_totals ON public.bookings;
CREATE TRIGGER trg_validate_booking_totals
AFTER UPDATE ON public.bookings
FOR EACH ROW
WHEN (NEW.status = 'nuevo'::booking_status)
EXECUTE FUNCTION public.validate_booking_totals();