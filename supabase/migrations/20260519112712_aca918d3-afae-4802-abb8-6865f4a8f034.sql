CREATE TABLE public.image_settings (
  url text PRIMARY KEY,
  focal_x numeric NOT NULL DEFAULT 50 CHECK (focal_x >= 0 AND focal_x <= 100),
  focal_y numeric NOT NULL DEFAULT 50 CHECK (focal_y >= 0 AND focal_y <= 100),
  zoom numeric NOT NULL DEFAULT 1 CHECK (zoom >= 1 AND zoom <= 3),
  focal_x_mobile numeric CHECK (focal_x_mobile IS NULL OR (focal_x_mobile >= 0 AND focal_x_mobile <= 100)),
  focal_y_mobile numeric CHECK (focal_y_mobile IS NULL OR (focal_y_mobile >= 0 AND focal_y_mobile <= 100)),
  zoom_mobile numeric CHECK (zoom_mobile IS NULL OR (zoom_mobile >= 1 AND zoom_mobile <= 3)),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.image_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read image_settings"
  ON public.image_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins insert image_settings"
  ON public.image_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update image_settings"
  ON public.image_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete image_settings"
  ON public.image_settings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_image_settings_updated_at
  BEFORE UPDATE ON public.image_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();