-- 투입 이력을 사람(사번) 기준으로 내구성 있게 보존
-- 배경: assignment_history.employee_id FK가 ON DELETE CASCADE라 직원 행 삭제 시 이력도 삭제됨.
--   비상주 다중투입은 프로젝트마다 행이 있어, 철수(행 삭제) 시 이력이 유실됨.
-- 조치:
--   1) employee_no 컬럼 추가 + 기존 이력 백필(직원 행이 남아 있는 경우)
--   2) employee_id를 nullable로 변경(SET NULL 위해)
--   3) FK를 ON DELETE CASCADE → ON DELETE SET NULL로 재생성(행 삭제돼도 이력 보존)
--   4) employee_no 조회 인덱스 추가
-- 안전성: 재실행 가능(IF NOT EXISTS/IF EXISTS). 데이터 삭제 없음.

BEGIN;

ALTER TABLE public.assignment_history
  ADD COLUMN IF NOT EXISTS employee_no TEXT;

UPDATE public.assignment_history h
SET employee_no = e.employee_no
FROM public.employees e
WHERE h.employee_id = e.id
  AND h.employee_no IS NULL
  AND e.employee_no IS NOT NULL;

ALTER TABLE public.assignment_history
  ALTER COLUMN employee_id DROP NOT NULL;

ALTER TABLE public.assignment_history
  DROP CONSTRAINT IF EXISTS assignment_history_employee_id_fkey;

ALTER TABLE public.assignment_history
  ADD CONSTRAINT assignment_history_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assignment_history_employee_no
  ON public.assignment_history (employee_no);

COMMIT;
