
-- handle_new_user is a trigger function, no need for anon/authenticated to call it directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- update_updated_at_column is also a trigger function
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
