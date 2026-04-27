CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin already exists. Bootstrap is no longer available.';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin'::app_role);
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_any_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role);
$$;

REVOKE ALL ON FUNCTION public.has_any_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_any_admin() TO anon, authenticated;