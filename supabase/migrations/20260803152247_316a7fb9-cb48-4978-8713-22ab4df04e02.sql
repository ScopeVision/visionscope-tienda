ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS region text;
COMMENT ON COLUMN public.customers.region IS 'Provincia / región (dato que ya pide el checkout público).';