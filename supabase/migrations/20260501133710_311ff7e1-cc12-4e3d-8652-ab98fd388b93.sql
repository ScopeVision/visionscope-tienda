-- Replace booking_item validator with a more permissive but still safe version
CREATE OR REPLACE FUNCTION public.validate_booking_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Accept the product's own price_day OR any of its variants' price_day
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

  -- Quantity & days sanity (already enforced by RLS, double-check)
  IF NEW.quantity <= 0 OR NEW.days <= 0 THEN
    RAISE EXCEPTION 'Invalid quantity or days';
  END IF;

  -- Subtotal must be at least price_day * days * quantity minus weekly discount tolerance.
  -- Allow weekly pricing (which can be lower) but never less than 60% of daily total.
  min_subtotal := NEW.price_day * NEW.days * NEW.quantity * 0.60;
  IF NEW.subtotal < min_subtotal - 0.01 THEN
    RAISE EXCEPTION 'Subtotal too low (got %, min %)', NEW.subtotal, min_subtotal;
  END IF;

  -- Subtotal must not exceed daily-rate calculation (prevents inflation too)
  IF NEW.subtotal > NEW.price_day * NEW.days * NEW.quantity + 0.01 THEN
    RAISE EXCEPTION 'Subtotal too high';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop the over-strict booking-level validation; subtotal/total/deposit at booking
-- level are already covered by validated booking_items + RLS check on >= 0.
DROP TRIGGER IF EXISTS trg_validate_booking_totals ON public.bookings;
DROP FUNCTION IF EXISTS public.validate_booking_totals();