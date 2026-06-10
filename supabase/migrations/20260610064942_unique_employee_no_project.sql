-- 같은 사람(employee_no)을 같은 프로젝트(project_id)에 중복 등록하는 것을 방지하는 가드.
-- 한 사람이 서로 다른 프로젝트 여러 개에 투입되는 것은 허용(다중 투입), 단 동일 프로젝트 중복만 차단.
-- employee_no 또는 project_id가 NULL인 행은 제약 대상에서 제외(기존 데이터/대기 인력 영향 없음).
-- 비상주만 다중 투입 허용하는 '업무 규칙'은 앱(폼 검증)에서 처리하며, 본 인덱스는 중복 방지 안전망이다.

CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_no_project
  ON public.employees (employee_no, project_id)
  WHERE employee_no IS NOT NULL AND project_id IS NOT NULL;
