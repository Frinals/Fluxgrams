/*
# Fix handle_new_user trigger function

## Problem
The SECURITY DEFINER trigger function `handle_new_user` had no explicit `search_path`,
causing it to fail during user signup because it could not resolve the `public.profiles`
table reference. This made the entire signup transaction roll back with 
"Database error saving new user".

## Fix
- Recreate the function with an explicit `search_path = public` setting
- Use fully-qualified `public.profiles` table reference for extra safety
- Re-attach the trigger
*/

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();