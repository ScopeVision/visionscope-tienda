CREATE OR REPLACE FUNCTION public.submit_checkout_request(
  _full_name text,
  _email text,
  _phone text,
  _company text,
  _tax_id text,
  _address_line1 text,
  _city text,
  _postal_code text,
  _country text,
  _notes text,
  _start_date date,
  _end_date date,
  _items jsonb
)
RETURNS TABLE(booking_id uuid, reference text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_full_name text := NULLIF(BTRIM(COALESCE(_full_name, '')), '');
  v_email text := LOWER(NULLIF(BTRIM(COALESCE(_email, '')), ''));
  v_phone text := NULLIF(BTRIM(COALESCE(_phone, '')), '');
  v_company text := NULLIF(BTRIM(COALESCE(_company, '')), '');
  v_tax_id text := NULLIF(BTRIM(COALESCE(_tax_id, '')), '');
  v_address_line1 text := NULLIF(BTRIM(COALESCE(_address_line1, '')), '');
  v_city text := NULLIF(BTRIM(COALESCE(_city, '')), '');
  v_postal_code text := NULLIF(BTRIM(COALESCE(_postal_code, '')), '');
  v_country text := NULLIF(BTRIM(COALESCE(_country, '')), '');
  v_notes text := NULLIF(BTRIM(COALESCE(_notes, '')), '');
BEGIN
  IF v_full_name IS NULL OR char_length(v_full_name) < 2 OR char_length(v_full_name) > 200 THEN
    RAISE EXCEPTION 'Nombre obligatorio: debe tener entre 2 y 200 caracteres';
  END IF;

  IF v_email IS NULL OR char_length(v_email) < 3 OR char_length(v_email) > 255 OR v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email no válido: usa el formato nombre@dominio.com';
  END IF;

  IF v_phone IS NULL OR char_length(v_phone) < 6 OR char_length(v_phone) > 40 THEN
    RAISE EXCEPTION 'Teléfono obligatorio: debe tener entre 6 y 40 caracteres';
  END IF;

  IF v_company IS NOT NULL AND char_length(v_company) > 200 THEN RAISE EXCEPTION 'Empresa demasiado larga'; END IF;
  IF v_tax_id IS NOT NULL AND char_length(v_tax_id) > 40 THEN RAISE EXCEPTION 'NIF/CIF demasiado largo'; END IF;
  IF v_address_line1 IS NOT NULL AND char_length(v_address_line1) > 200 THEN RAISE EXCEPTION 'Dirección demasiado larga'; END IF;
  IF v_city IS NOT NULL AND char_length(v_city) > 100 THEN RAISE EXCEPTION 'Ciudad demasiado larga'; END IF;
  IF v_postal_code IS NOT NULL AND char_length(v_postal_code) > 20 THEN RAISE EXCEPTION 'Código postal demasiado largo'; END IF;
  IF v_country IS NOT NULL AND char_length(v_country) > 100 THEN RAISE EXCEPTION 'País demasiado largo'; END IF;
  IF v_notes IS NOT NULL AND char_length(v_notes) > 2000 THEN RAISE EXCEPTION 'Notas demasiado largas'; END IF;

  INSERT INTO public.customers (
    full_name,
    email,
    phone,
    company,
    tax_id,
    address_line1,
    city,
    postal_code,
    country
  ) VALUES (
    v_full_name,
    v_email,
    v_phone,
    v_company,
    v_tax_id,
    v_address_line1,
    v_city,
    v_postal_code,
    v_country
  )
  RETURNING id INTO v_customer_id;

  RETURN QUERY
  SELECT cb.booking_id, cb.reference
  FROM public.create_booking_with_items(
    v_customer_id,
    _start_date,
    _end_date,
    v_notes,
    _items
  ) AS cb;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_checkout_request(text, text, text, text, text, text, text, text, text, text, date, date, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_checkout_request(text, text, text, text, text, text, text, text, text, text, date, date, jsonb) TO anon, authenticated;