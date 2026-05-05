REVOKE ALL ON FUNCTION public.submit_checkout_request(text, text, text, text, text, text, text, text, text, text, date, date, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_checkout_request(text, text, text, text, text, text, text, text, text, text, date, date, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.submit_checkout_request(text, text, text, text, text, text, text, text, text, text, date, date, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_checkout_request(text, text, text, text, text, text, text, text, text, text, date, date, jsonb) TO service_role;