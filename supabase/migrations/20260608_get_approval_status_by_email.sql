-- 적용: Supabase 대시보드 SQL Editor에 전체 내용 붙여넣기 후 실행

-- 비로그인(anon) 상태에서 이메일로 approval_status, rejected_reason 조회용 함수
-- SECURITY DEFINER: RLS를 우회하여 함수 내부에서 직접 조회
-- anon role에 실행 권한 부여
CREATE OR REPLACE FUNCTION public.get_approval_status_by_email(p_email TEXT)
RETURNS TABLE(approval_status TEXT, rejected_reason TEXT)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT approval_status, rejected_reason
  FROM public.profiles
  WHERE email = p_email
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_approval_status_by_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_approval_status_by_email(TEXT) TO authenticated;
