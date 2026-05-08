
CREATE TABLE public.store_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  price numeric NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published store_products"
  ON public.store_products
  FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage store_products"
  ON public.store_products
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER store_products_set_updated_at
  BEFORE UPDATE ON public.store_products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_store_products_published ON public.store_products(published);
CREATE INDEX idx_store_products_sort ON public.store_products(sort_order);
