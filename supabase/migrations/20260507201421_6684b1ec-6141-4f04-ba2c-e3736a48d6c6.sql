
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-content', 'site-content', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read site-content"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-content');

CREATE POLICY "Admins upload site-content"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-content' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update site-content"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-content' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete site-content"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-content' AND public.has_role(auth.uid(), 'admin'::app_role));
