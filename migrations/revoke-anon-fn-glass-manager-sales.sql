-- 보안: SECURITY DEFINER 함수를 공개(anon)·로그인(authenticated) 역할이 REST로 호출하지 못하게.
-- 앱은 서버(service_role)에서만 호출(app/api/admin/client-analysis). 적용: 2026-10-02
revoke execute on function public.fn_glass_manager_sales(text, text) from public, anon, authenticated;
grant execute on function public.fn_glass_manager_sales(text, text) to service_role;
