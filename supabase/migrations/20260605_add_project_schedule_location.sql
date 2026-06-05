-- REQ-PROJ-001: projects 테이블에 일정 및 장소 컬럼 추가
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS start_date   DATE         NULL,
  ADD COLUMN IF NOT EXISTS end_date     DATE         NULL,
  ADD COLUMN IF NOT EXISTS location_name VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS address       VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS address_detail VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS latitude      DECIMAL(10,7) NULL,
  ADD COLUMN IF NOT EXISTS longitude     DECIMAL(10,7) NULL;

COMMENT ON COLUMN projects.start_date     IS '프로젝트 시작일';
COMMENT ON COLUMN projects.end_date       IS '프로젝트 종료일';
COMMENT ON COLUMN projects.location_name  IS '장소명';
COMMENT ON COLUMN projects.address        IS '도로명주소 (향후 GPS 위치 추적 대비)';
COMMENT ON COLUMN projects.address_detail IS '상세주소';
COMMENT ON COLUMN projects.latitude       IS '위도 (GPS 연동용)';
COMMENT ON COLUMN projects.longitude      IS '경도 (GPS 연동용)';
