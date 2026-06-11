-- 인덱스 정합성 정리: uq_employees_no_project 부분 조건을 파일 기준으로 일치시킨다.
-- 배포 DB에는 WHERE (employee_no IS NOT NULL) 까지만 적용되어 있어,
-- 파일 정의(WHERE employee_no IS NOT NULL AND project_id IS NOT NULL)와 어긋나 있었음.
-- 새 조건은 기존보다 좁은 범위(부분집합)라 데이터 위반 가능성 없음(사전 점검 완료: 중복 0건).
-- 기능 영향 없음 - NULL 사번/NULL 프로젝트 행은 어느 경우든 인덱스 대상에서 제외됨.

DROP INDEX IF EXISTS public.uq_employees_no_project;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_no_project
  ON public.employees (employee_no, project_id)
  WHERE employee_no IS NOT NULL AND project_id IS NOT NULL;
