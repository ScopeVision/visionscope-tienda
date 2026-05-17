
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS coverage text,
  ADD COLUMN IF NOT EXISTS series text,
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS is_anamorphic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vintage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_rehoused boolean NOT NULL DEFAULT false;
