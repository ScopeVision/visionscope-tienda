-- Owner change history for assets
CREATE TABLE IF NOT EXISTS public.finance_asset_owner_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  previous_owner_id uuid,
  new_owner_id uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  note text
);

ALTER TABLE public.finance_asset_owner_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage finance_asset_owner_history"
ON public.finance_asset_owner_history
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_finance_asset_owner_history_asset
  ON public.finance_asset_owner_history(asset_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.track_asset_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.finance_asset_owner_history (asset_id, previous_owner_id, new_owner_id, changed_by, note)
    VALUES (NEW.id, NULL, NEW.owner_id, auth.uid(), 'initial');
  ELSIF TG_OP = 'UPDATE' AND OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    INSERT INTO public.finance_asset_owner_history (asset_id, previous_owner_id, new_owner_id, changed_by, note)
    VALUES (NEW.id, OLD.owner_id, NEW.owner_id, auth.uid(), 'change');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_asset_owner_change ON public.finance_assets;
CREATE TRIGGER trg_finance_asset_owner_change
AFTER INSERT OR UPDATE OF owner_id ON public.finance_assets
FOR EACH ROW EXECUTE FUNCTION public.track_asset_owner_change();