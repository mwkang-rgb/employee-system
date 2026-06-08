-- REQ-PROJ-002: projects 테이블에 프로젝트 유형 컬럼 추가
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type VARCHAR(20) NULL;

COMMENT ON COLUMN projects.project_type IS '프로젝트 유형 (대외 프로젝트, 행내 프로젝트, 사내 프로젝트)';
