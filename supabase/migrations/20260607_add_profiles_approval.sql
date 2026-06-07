-- ============================================================
-- Google OAuth 가입 승인 관리 기능
-- 적용: Supabase SQL Editor에 전체 내용 붙여넣기 후 실행
-- ============================================================

-- ------------------------------------------------------------
-- 1. public.profiles 테이블 생성 (없으면) 또는 컬럼 추가
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  role        TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at   TIMESTAMPTZ,
  approved_by   UUID REFERENCES auth.users(id),
  rejected_at   TIMESTAMPTZ,
  rejected_by   UUID REFERENCES auth.users(id),
  rejected_reason TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 테이블에 컬럼이 없으면 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  approved_at TIMESTAMPTZ;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  approved_by UUID REFERENCES auth.users(id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  rejected_at TIMESTAMPTZ;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  rejected_by UUID REFERENCES auth.users(id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  rejected_reason TEXT;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ------------------------------------------------------------
-- 2. 신규 사용자 자동 생성 트리거
--    Google OAuth 로 auth.users 에 사용자가 생성되면
--    public.profiles 에 pending 상태로 자동 삽입된다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, avatar_url,
    approval_status, role, requested_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name'
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'pending',
    'user',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 3. 권한 확인 함수
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND approval_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND approval_status = 'approved'
  );
$$;

-- ------------------------------------------------------------
-- 4. profiles RLS 정책
-- ------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles"   ON public.profiles;

-- 본인 프로필 조회
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- 관리자: 전체 조회
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_admin());

-- 관리자: 승인/반려 UPDATE
CREATE POLICY "Admins can update profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 5. 업무 테이블 RLS (미승인 사용자 접근 차단)
--    기존 정책이 있으면 먼저 확인 후 적용.
--    아래는 예시이며, 실제 정책명은 프로젝트에 맞게 조정한다.
-- ------------------------------------------------------------

-- employees 테이블
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users can access employees" ON public.employees;
CREATE POLICY "Approved users can access employees"
ON public.employees FOR ALL TO authenticated
USING (public.is_approved_user())
WITH CHECK (public.is_approved_user());

-- projects 테이블
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users can access projects" ON public.projects;
CREATE POLICY "Approved users can access projects"
ON public.projects FOR ALL TO authenticated
USING (public.is_approved_user())
WITH CHECK (public.is_approved_user());

-- assignment_history 테이블
ALTER TABLE public.assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users can access assignment_history" ON public.assignment_history;
CREATE POLICY "Approved users can access assignment_history"
ON public.assignment_history FOR ALL TO authenticated
USING (public.is_approved_user())
WITH CHECK (public.is_approved_user());

-- ------------------------------------------------------------
-- 6. 최초 관리자 지정
--    아래 SQL을 별도로 실행한다 (이메일 주소를 직접 입력).
--
--    UPDATE public.profiles
--    SET role = 'admin',
--        approval_status = 'approved',
--        approved_at = NOW()
--    WHERE email = '관리자이메일@gmail.com';
--
--    기존 auth.users에 사용자가 있으나 profiles 행이 없으면
--    아래 SQL로 수동 삽입한다:
--
--    INSERT INTO public.profiles (id, email, full_name, approval_status, role, requested_at)
--    SELECT id, email,
--           COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
--           'approved', 'admin', NOW()
--    FROM auth.users
--    WHERE email = '관리자이메일@gmail.com'
--    ON CONFLICT (id) DO UPDATE
--      SET role = 'admin', approval_status = 'approved', approved_at = NOW();
-- ------------------------------------------------------------
