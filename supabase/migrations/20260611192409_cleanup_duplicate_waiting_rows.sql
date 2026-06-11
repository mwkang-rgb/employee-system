-- 일회성 정리: 비상주 다중투입 직원 철수 시 발생한 대기 중복 행 정리 + 대기 표기 정규화
-- 배경:
--   1) 같은 사번이 여러 대기 행을 갖는 중복(예: 강민우 사번 99201 → 3행) 제거.
--   2) 대기 행의 project_id 표기가 'pool'과 NULL로 혼재 → 통계('대기 인력'은 project_id='pool'만 집계)와
--      보드 대기 컬럼(‘pool’+NULL 표시)이 어긋남. NULL 대기 행을 'pool'로 정규화해 일치시킴.
-- 안전성: 두 문장 모두 재실행해도 무해(중복/NULL이 없으면 0건 처리). 대기 행만 대상, 활성 투입 행은 건드리지 않음.

BEGIN;

-- 1) 같은 사번의 대기 중복 행 제거 — 사번별 가장 작은 id 1행만 보존
WITH waiting_dups AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY employee_no ORDER BY id) AS rn
  FROM public.employees
  WHERE employee_no IS NOT NULL
    AND assignment_type = '대기'
    AND (project_id IS NULL OR project_id = 'pool')
)
DELETE FROM public.employees
WHERE id IN (SELECT id FROM waiting_dups WHERE rn > 1);

-- 2) 대기 행 표기 정규화 — NULL → 'pool' (통계/보드 집계 일치)
UPDATE public.employees
SET project_id = 'pool'
WHERE project_id IS NULL
  AND assignment_type = '대기';

COMMIT;
