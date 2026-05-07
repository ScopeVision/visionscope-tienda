
-- ============================================================
-- HERO SLIDES
-- ============================================================
CREATE TABLE public.hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  cta_label text NOT NULL DEFAULT '',
  cta_url text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read hero slides"
  ON public.hero_slides FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage hero slides"
  ON public.hero_slides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_hero_slides_updated_at
  BEFORE UPDATE ON public.hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- CATEGORIES: image + link
-- ============================================================
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS link_url text;

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE public.project_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  cover_image text NOT NULL DEFAULT '',
  gallery text[] NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT '',
  client text NOT NULL DEFAULT '',
  year integer,
  link_url text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read project items"
  ON public.project_items FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage project items"
  ON public.project_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_project_items_updated_at
  BEFORE UPDATE ON public.project_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PUBLIC CONTACT (expose only safe fields, not orders_email)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_public_contact()
RETURNS TABLE(whatsapp_url text, instagram_url text, contact_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT whatsapp_url, instagram_url, contact_email
  FROM public.site_settings
  WHERE id = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_contact() TO anon, authenticated;
