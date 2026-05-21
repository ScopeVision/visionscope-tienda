
-- Categories
CREATE TABLE public.store_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES public.store_categories(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read store_categories" ON public.store_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage store_categories" ON public.store_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER store_categories_updated_at BEFORE UPDATE ON public.store_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend store_products
ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.store_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS stock int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS short_description text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_store_products_category ON public.store_products(category_id);

-- Variants
CREATE TABLE public.store_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sku text,
  price numeric NOT NULL DEFAULT 0,
  stock int NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read store_variants" ON public.store_variants FOR SELECT USING (true);
CREATE POLICY "Admins manage store_variants" ON public.store_variants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_store_variants_product ON public.store_variants(product_id);
CREATE TRIGGER store_variants_updated_at BEFORE UPDATE ON public.store_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tags
CREATE TABLE public.store_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read store_tags" ON public.store_tags FOR SELECT USING (true);
CREATE POLICY "Admins manage store_tags" ON public.store_tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Product <-> Tags
CREATE TABLE public.store_product_tags (
  product_id uuid NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.store_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
ALTER TABLE public.store_product_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read store_product_tags" ON public.store_product_tags FOR SELECT USING (true);
CREATE POLICY "Admins manage store_product_tags" ON public.store_product_tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
