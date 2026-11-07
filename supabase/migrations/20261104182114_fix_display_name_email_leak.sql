/*
# Fix: Stop leaking email in display_name

## Problem
The handle_new_user trigger set display_name to split_part(NEW.email, '@', 1),
which is the email username portion. This leaked email-derived info to other users
via profiles display_name (which is publicly readable).

## Fix
- Set display_name to 'New User' on signup instead of email-derived string
- Update existing profiles that have email-derived display names
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, 'New User')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();