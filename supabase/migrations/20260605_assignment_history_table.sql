-- ============================================================
-- REQ-EMP-002: assignment_history 테이블 정규화 마이그레이션
-- ============================================================

-- 1. 정규화 테이블 생성
CREATE TABLE IF NOT EXISTS assignment_history (
  id              text         PRIMARY KEY,
  employee_id     uuid         NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id      uuid         REFERENCES projects(id) ON DELETE SET NULL,
  project_name    text,
  duty            text,
  role            text,
  assignment_type text,
  start_date      date,
  end_date        date,
  created_at      timestamptz  DEFAULT now()
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_ah_employee_id ON assignment_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_ah_project_id  ON assignment_history(project_id);
CREATE INDEX IF NOT EXISTS idx_ah_start_date  ON assignment_history(start_date);

-- 3. 기존 JSONB 데이터 마이그레이션
--    - 빈 문자열, 1111-01-01, 9999-12-31 → NULL 변환
--    - project_id는 현재 projects 테이블 이름으로 역참조 (없으면 NULL)
--    - 중복 실행 안전: ON CONFLICT DO NOTHING
INSERT INTO assignment_history (
  id, employee_id, project_id, project_name,
  duty, role, assignment_type,
  start_date, end_date
)
SELECT
  h->>'id',
  e.id,
  p.id,
  h->>'projectName',
  NULLIF(h->>'duty', ''),
  NULLIF(h->>'role', ''),
  NULLIF(h->>'assignmentType', ''),
  CASE
    WHEN h->>'startDate' IS NULL OR h->>'startDate' IN ('', '1111-01-01') THEN NULL
    ELSE (h->>'startDate')::date
  END,
  CASE
    WHEN h->>'endDate' IS NULL OR h->>'endDate' IN ('', '9999-12-31') THEN NULL
    ELSE (h->>'endDate')::date
  END
FROM employees e
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(e.assignment_history) = 'array' THEN e.assignment_history
    ELSE '[]'::jsonb
  END
) AS h
LEFT JOIN projects p ON p.name = h->>'projectName'
WHERE (h->>'id') IS NOT NULL
  AND (h->>'id') <> ''
ON CONFLICT (id) DO NOTHING;
