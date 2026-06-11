-- 일회성 정리: 대기 상태 직원의 상주 구분을 '상주'로 통일
-- 배경: 대기 전환 시 상주 구분을 '상주'로 초기화하는 규칙을 신규 적용함에 따라,
--   이미 대기 상태인 기존 직원(예: 강민우 비상주)의 상주 구분도 '상주'로 맞춤.
-- 대상: assignment_type = '대기'이면서 상주 구분이 '상주'가 아닌 행.
-- 안전성: 재실행해도 무해(이미 상주면 0건). 대기 상태 행만 변경, 투입 중 행은 건드리지 않음.

UPDATE public.employees
SET residency_type = '상주'
WHERE assignment_type = '대기'
  AND residency_type IS DISTINCT FROM '상주';
