-- 일회성 정리: 중복 투입 이력(assignment_history) 제거
-- 배경: 추가 투입 오노출 + 대기 중복 버그의 부작용으로, 같은 사람이 같은 프로젝트를
--   같은 투입일(start_date)로 시작한 이력이 철수일(end_date)만 다른 채 중복 기록됨.
--   (예: 강민우 '인력운영 시스템 신규 구축' 06-10/06-11, 김덕선 'KDB캐피탈' 등)
-- 규칙: (employee_id, project_name, start_date)가 같은 그룹은 1건만 보존.
--   보존 기준은 철수일(end_date)이 가장 늦은(가장 완전한) 행, 동률이면 가장 최근 id.
-- 안전성: 재실행해도 무해(중복이 없으면 0건). 투입일이 다르면 별개 투입으로 보존됨.

BEGIN;

WITH dups AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY employee_id, project_name, start_date
           ORDER BY end_date DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.assignment_history
)
DELETE FROM public.assignment_history
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

COMMIT;
