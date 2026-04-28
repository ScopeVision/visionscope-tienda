-- 1. Añadir kit_mode a products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS kit_mode text NOT NULL DEFAULT 'individual'
    CHECK (kit_mode IN ('individual', 'lens_kit', 'camera_kit', 'pack'));

-- 2. Tabla de componentes de kits/packs (modelo unificado)
CREATE TABLE IF NOT EXISTS public.product_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  child_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_name text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_day_override numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_components_no_self CHECK (parent_product_id <> child_product_id),
  CONSTRAINT product_components_unique UNIQUE (parent_product_id, child_product_id, variant_name)
);

CREATE INDEX IF NOT EXISTS idx_product_components_parent
  ON public.product_components(parent_product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_components_child
  ON public.product_components(child_product_id);

ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product_components"
  ON public.product_components FOR SELECT
  USING (true);

CREATE POLICY "Admins manage product_components"
  ON public.product_components FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER product_components_set_updated_at
  BEFORE UPDATE ON public.product_components
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();