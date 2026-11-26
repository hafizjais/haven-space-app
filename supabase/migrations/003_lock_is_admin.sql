-- is_admin() only tells a signed-in user whether they themselves are an admin; RLS needs authenticated to run it.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.check_payment() from public, anon, authenticated;
