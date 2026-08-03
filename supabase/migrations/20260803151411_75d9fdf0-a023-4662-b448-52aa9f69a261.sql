ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_status_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_status_check
  CHECK (status IN ('active','observation','test','inactive','blocked'));

UPDATE public.customers SET status = 'active' WHERE status IS NULL OR status NOT IN ('active','observation','test','inactive','blocked');

CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers USING btree (status);

COMMENT ON COLUMN public.customers.status IS 'Clasificación CRM: active=cliente normal; observation=requiere seguimiento; test=registro de prueba (excluido de estadísticas); inactive=sin actividad; blocked=no se le alquila.';