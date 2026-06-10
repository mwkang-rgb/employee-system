-- 사번(employee_no) 컬럼 추가
-- 동일 인물이 여러 프로젝트에 등록될 때(특히 비상주) 같은 사람임을 식별하는 키.
-- 한 사람이 여러 행을 가질 수 있으므로 employee_no 단독 UNIQUE 제약은 두지 않는다.
-- 기존 행은 NULL(미입력) 상태로 두며, 통계 집계 시 NULL 행은 각자 1명으로 계산(행 id로 폴백)한다.
-- 조회/그룹핑 성능을 위해 인덱스만 추가.
-- RLS: employees 정책은 is_approved_user() 기반 FOR ALL 이라 컬럼 추가만으로 충분(정책 변경 없음).

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_no TEXT;

CREATE INDEX IF NOT EXISTS idx_employees_employee_no
  ON public.employees (employee_no);

-- (선택) 같은 사람을 같은 프로젝트에 중복 등록하는 것을 막고 싶다면 아래 주석을 해제.
-- employee_no가 NULL인 행끼리는 충돌하지 않으므로 기존 데이터에 영향 없음.
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_no_project
--   ON public.employees (employee_no, project_id)
--   WHERE employee_no IS NOT NULL;
