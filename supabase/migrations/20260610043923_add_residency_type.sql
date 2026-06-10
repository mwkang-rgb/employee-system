-- 상주 구분(상주/비상주) 컬럼 추가
-- employees 테이블에 residency_type 컬럼 신설.
-- NOT NULL DEFAULT '상주' 이므로 기존 전체 행은 '상주'로 자동 백필됨(별도 UPDATE 불필요).
-- 허용값은 '상주', '비상주' 2가지로 CHECK 제약.
-- RLS: employees 정책은 is_approved_user() 기반 FOR ALL 이라 컬럼 추가만으로 충분(정책 변경 없음).

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS residency_type TEXT NOT NULL DEFAULT '상주'
    CHECK (residency_type IN ('상주', '비상주'));
