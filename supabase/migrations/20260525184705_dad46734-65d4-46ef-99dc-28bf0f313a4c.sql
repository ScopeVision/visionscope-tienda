
CREATE OR REPLACE FUNCTION public.update_partner_equity(_changes jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_changes) LOOP
    UPDATE public.finance_partners
       SET profit_share_pct = (v_item->>'pct')::numeric
     WHERE id = (v_item->>'id')::uuid;
  END LOOP;
END;
$$;
