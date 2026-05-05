
CREATE TABLE IF NOT EXISTS public.site_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  orders_email text NOT NULL DEFAULT 'thevisionscope.ventas@gmail.com',
  contact_email text NOT NULL DEFAULT 'thevisionscope.ventas@gmail.com',
  whatsapp_url text NOT NULL DEFAULT 'https://wa.me/qr/3BHCCMSKBRQZP1',
  instagram_url text NOT NULL DEFAULT 'https://www.instagram.com/thevisionscope/',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read site_settings" ON public.site_settings
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins update site_settings" ON public.site_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert site_settings" ON public.site_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.site_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;
