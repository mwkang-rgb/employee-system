-- REQ-EMP-002: employees.assignment_history_deprecated 컬럼 삭제
-- 정규화 검증 완료 후 deprecated 컬럼 제거
ALTER TABLE employees DROP COLUMN assignment_history_deprecated;
