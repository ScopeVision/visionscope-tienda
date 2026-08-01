ALTER VIEW public.finance_period_v SET (security_invoker = on);
ALTER VIEW public.product_popularity SET (security_invoker = on);

CREATE POLICY "Public read product-images and site-content"
ON storage.objects FOR SELECT
USING (bucket_id IN ('product-images','site-content'));

CREATE POLICY "Admins can upload product-images and site-content"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('product-images','site-content') AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update product-images and site-content"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('product-images','site-content') AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id IN ('product-images','site-content') AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete product-images and site-content"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('product-images','site-content') AND public.has_role(auth.uid(), 'admin'::public.app_role));