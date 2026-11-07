-- Revoke direct API access to handle_new_user (should only run via trigger)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;