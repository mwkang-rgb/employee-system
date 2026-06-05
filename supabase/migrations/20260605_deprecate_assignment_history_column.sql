-- ============================================================
-- REQ-EMP-002: employees.assignment_history 컬럼 deprecated 처리
-- 정규화된 assignment_history 테이블로 이관 완료 후 컬럼 보존
-- ============================================================

ALTER TABLE employees
  RENAME COLUMN assignment_history TO assignment_history_deprecated;

COMMENT ON COLUMN employees.assignment_history_deprecated IS
  'DEPRECATED (2026-06-05, REQ-EMP-002): 정규화된 assignment_history 테이블로 이관 완료. 검증 기간 후 별도 삭제 요건으로 처리.';
