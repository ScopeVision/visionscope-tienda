-- Add structured fields to products for advanced filtering
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS mount text,
  ADD COLUMN IF NOT EXISTS sensor_type text,
  ADD COLUMN IF NOT EXISTS lens_type text,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS lighting_type text,
  ADD COLUMN IF NOT EXISTS grip_type text,
  ADD COLUMN IF NOT EXISTS accessory_type text,
  ADD COLUMN IF NOT EXISTS kit_type text,
  ADD COLUMN IF NOT EXISTS model text;

CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_mount ON public.products(mount);
CREATE INDEX IF NOT EXISTS idx_products_sensor_type ON public.products(sensor_type);
CREATE INDEX IF NOT EXISTS idx_products_lens_type ON public.products(lens_type);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- Replace categories with the 6 official ones (safe: removes existing first)
DELETE FROM public.categories;

INSERT INTO public.categories (slug, name_es, name_en, name_ca, name_fr, sort_order) VALUES
  ('cameras',     'Cámaras',     'Cameras',     'Càmeres',     'Caméras',      1),
  ('lenses',      'Ópticas',     'Lenses',      'Òptiques',    'Optiques',     2),
  ('lighting',    'Iluminación', 'Lighting',    'Il·luminació','Éclairage',    3),
  ('grip',        'Grip',        'Grip',        'Grip',        'Grip',         4),
  ('accessories', 'Accesorios',  'Accessories', 'Accessoris',  'Accessoires',  5),
  ('kits',        'Kits',        'Kits',        'Kits',        'Kits',         6);
