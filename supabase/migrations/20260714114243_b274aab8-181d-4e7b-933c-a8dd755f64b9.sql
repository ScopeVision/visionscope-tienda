
-- 1a. Add internal_code to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS internal_code text;
CREATE UNIQUE INDEX IF NOT EXISTS products_internal_code_key ON public.products(internal_code) WHERE internal_code IS NOT NULL;

-- 1b. Add PIN to site_settings
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS internal_code_pin text;

-- 1c. Helper: prefix from category
CREATE OR REPLACE FUNCTION public.internal_code_prefix(p_category_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
BEGIN
  IF p_category_id IS NULL THEN RETURN 'KIT'; END IF;
  SELECT slug INTO v_slug FROM public.categories WHERE id = p_category_id;
  RETURN CASE v_slug
    WHEN 'cameras' THEN 'CAM'
    WHEN 'lenses' THEN 'OPT'
    WHEN 'lighting' THEN 'LUM'
    WHEN 'grip' THEN 'GRP'
    WHEN 'accessories' THEN 'ACC'
    WHEN 'n' THEN 'SET'
    ELSE 'KIT'
  END;
END;
$$;

-- Generator function
CREATE OR REPLACE FUNCTION public.generate_internal_code(p_category_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_max int;
BEGIN
  v_prefix := public.internal_code_prefix(p_category_id);
  SELECT COALESCE(MAX((substring(internal_code from '^' || v_prefix || '-(\d+)$'))::int), 0)
    INTO v_max
    FROM public.products
   WHERE internal_code ~ ('^' || v_prefix || '-\d+$');
  RETURN v_prefix || '-' || lpad((v_max + 1)::text, 4, '0');
END;
$$;

-- Trigger to auto-assign on insert if NULL
CREATE OR REPLACE FUNCTION public.trg_products_assign_internal_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.internal_code IS NULL OR btrim(NEW.internal_code) = '' THEN
    NEW.internal_code := public.generate_internal_code(NEW.category_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_assign_internal_code ON public.products;
CREATE TRIGGER products_assign_internal_code
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_products_assign_internal_code();

-- 1d. Backfill existing products
DO $$
DECLARE
  r record;
  v_prefix text;
  v_counter int;
  v_last_cat uuid;
BEGIN
  v_last_cat := '00000000-0000-0000-0000-000000000000';
  v_counter := 0;
  FOR r IN
    SELECT id, category_id
    FROM public.products
    WHERE internal_code IS NULL
    ORDER BY category_id NULLS LAST, created_at ASC
  LOOP
    v_prefix := public.internal_code_prefix(r.category_id);
    SELECT COALESCE(MAX((substring(internal_code from '^' || v_prefix || '-(\d+)$'))::int), 0) + 1
      INTO v_counter
      FROM public.products
     WHERE internal_code ~ ('^' || v_prefix || '-\d+$');
    UPDATE public.products
       SET internal_code = v_prefix || '-' || lpad(v_counter::text, 4, '0')
     WHERE id = r.id;
  END LOOP;
END $$;
