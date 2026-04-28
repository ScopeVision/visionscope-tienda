CREATE OR REPLACE FUNCTION public.available_stock(
  _product_id uuid,
  _start date,
  _end date
)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    COALESCE((SELECT stock FROM public.products WHERE id = _product_id), 0)
      - COALESCE((
        SELECT SUM(bi.quantity)::int
        FROM public.booking_items bi
        JOIN public.bookings b ON b.id = bi.booking_id
        WHERE bi.product_id = _product_id
          AND b.status IN ('nuevo', 'confirmado', 'preparacion', 'alquiler')
          AND b.start_date <= _end
          AND b.end_date >= _start
      ), 0),
    0
  );
$$;

REVOKE EXECUTE ON FUNCTION public.available_stock(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.available_stock(uuid, date, date) TO anon, authenticated;