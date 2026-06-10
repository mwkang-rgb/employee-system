// ───────────────────────────────────────────────────────────
// 초기 데이터 상수
// ───────────────────────────────────────────────────────────
export const RANKS = ["사원", "대리", "과장", "차장", "팀장", "부장", "교수", "본부장"];
export const AFFILIATIONS = ["IBKS", "협력사"];
export const SAMPLE_PARTNERS = ["LG CNS", "삼성SDS", "SK C&C", "롯데정보통신", "포스코DX", "한화시스템", "대우정보시스템", "아이티센"];
export const SAMPLE_DUTIES = ["개발", "분석/설계", "기획", "PM", "PL", "아키텍트", "DBA", "테스트", "운영", "인프라", "보안", "UI/UX"];
export const SAMPLE_ROLES = ["프로젝트 총괄", "파트 리더", "백엔드 개발", "프론트엔드 개발", "풀스택 개발", "DB 설계", "요구사항 분석", "화면 설계", "테스트 자동화", "시스템 운영", "기술 검토", "품질 관리"];

// 투입 형태
export const ASSIGNMENT_TYPES = ["대기", "계약", "비계약", "지원", "투입예정"];
export const RESIDENCY_TYPES = ["상주", "비상주"];
export const ASSIGNMENT_TYPE_STYLES = {
  "대기":   { badge: "bg-slate-100 text-slate-600 border-slate-300", dot: "bg-slate-400", desc: "현재 투입 프로젝트 없음 (대기 상태)" },
  "계약":   { badge: "bg-blue-50 text-blue-700 border-blue-200",   dot: "bg-blue-500",   desc: "공식 계약 기반 투입 (수임/도급)" },
  "비계약": { badge: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500", desc: "내부 인력 풀 활용 투입" },
  "지원":   { badge: "bg-teal-50 text-teal-700 border-teal-200",   dot: "bg-teal-500",   desc: "타 프로젝트 일시 지원" },
  "투입예정": { badge: "bg-sky-50 text-sky-700 border-sky-200",    dot: "bg-sky-500",    desc: "투입 예정 인력" },
};

// 직급 정렬 우선순위 (낮을수록 상위)
export const RANK_ORDER = { "본부장": 1, "부장": 2, "교수": 2, "팀장": 3, "차장": 4, "과장": 5, "대리": 6, "사원": 7 };

// 대기 컬럼 정렬 옵션
export const POOL_SORT_OPTIONS = [
  { value: "waitingDays", label: "대기일수" },
  { value: "endDate", label: "철수일자" },
  { value: "startDate", label: "투입일자" },
  { value: "rank", label: "직급" },
  { value: "duty", label: "직무" },
  { value: "name", label: "이름" },
  { value: "added", label: "등록순" },
  { value: "manual", label: "수동 정렬" },
];

export const INITIAL_PROJECTS = [
  { id: "pool", name: "대기", color: "slate" },
  { id: "p1", name: "IBK 차세대 시스템", color: "indigo" },
  { id: "p2", name: "KDB캐피탈 차세대", color: "blue" },
  { id: "p3", name: "부천시금고", color: "emerald" },
  { id: "p4", name: "여신 통합플랫폼", color: "violet" },
  { id: "p5", name: "AML 고도화", color: "rose" },
  { id: "p6", name: "MyData 연계", color: "amber" },
  { id: "p7", name: "인터넷뱅킹 개편", color: "teal" },
  { id: "p8", name: "기업여신 심사시스템", color: "cyan" },
  { id: "p9", name: "통합콜센터 구축", color: "fuchsia" },
  { id: "p10", name: "대외연계 게이트웨이", color: "lime" },
  { id: "p11", name: "리스크관리 시스템", color: "orange" },
  { id: "p12", name: "채널계 현대화", color: "sky" },
];

export const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "전"];
export const GIVEN_NAMES = ["민수", "지훈", "서연", "예준", "도윤", "시우", "하준", "주원", "지호", "건우", "현우", "우진", "선우", "연우", "유준", "정우", "승현", "태민", "재현", "동현", "수빈", "지민", "하은", "서윤", "지우", "채원", "수아", "예린", "나연", "소율"];

export const COLOR_MAP = {
  indigo: { bg: "bg-indigo-50", border: "border-indigo-200", dot: "bg-indigo-500", text: "text-indigo-700", header: "bg-indigo-100/60" },
  blue: { bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500", text: "text-blue-700", header: "bg-blue-100/60" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", text: "text-emerald-700", header: "bg-emerald-100/60" },
  violet: { bg: "bg-violet-50", border: "border-violet-200", dot: "bg-violet-500", text: "text-violet-700", header: "bg-violet-100/60" },
  rose: { bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500", text: "text-rose-700", header: "bg-rose-100/60" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", text: "text-amber-700", header: "bg-amber-100/60" },
  teal: { bg: "bg-teal-50", border: "border-teal-200", dot: "bg-teal-500", text: "text-teal-700", header: "bg-teal-100/60" },
  cyan: { bg: "bg-cyan-50", border: "border-cyan-200", dot: "bg-cyan-500", text: "text-cyan-700", header: "bg-cyan-100/60" },
  fuchsia: { bg: "bg-fuchsia-50", border: "border-fuchsia-200", dot: "bg-fuchsia-500", text: "text-fuchsia-700", header: "bg-fuchsia-100/60" },
  lime: { bg: "bg-lime-50", border: "border-lime-200", dot: "bg-lime-500", text: "text-lime-700", header: "bg-lime-100/60" },
  orange: { bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500", text: "text-orange-700", header: "bg-orange-100/60" },
  sky: { bg: "bg-sky-50", border: "border-sky-200", dot: "bg-sky-500", text: "text-sky-700", header: "bg-sky-100/60" },
  slate: { bg: "bg-slate-50", border: "border-slate-300", dot: "bg-slate-400", text: "text-slate-600", header: "bg-slate-100" },
};
export const COLOR_OPTIONS = Object.keys(COLOR_MAP).filter(c => c !== "slate");
