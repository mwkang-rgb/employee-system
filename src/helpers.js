import {
  RANKS, SAMPLE_PARTNERS, SAMPLE_DUTIES, SAMPLE_ROLES,
  SURNAMES, GIVEN_NAMES,
} from "./constants.js";

// 두 날짜 사이의 랜덤 날짜 반환 (YYYY-MM-DD)
export const randomDate = (start, end) => {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().slice(0, 10);
};

// 오늘 날짜를 YYYY-MM-DD 문자열로 반환
export const todayISO = () => new Date().toISOString().slice(0, 10);

// 투입 상태 계산 (대기 / 예정 / 투입중 / 종료)
export const getStatus = (startDate, endDate, projectId) => {
  if (projectId === "pool") return { label: "대기", color: "bg-amber-50 text-amber-700 border-amber-200" };
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return { label: "예정", color: "bg-slate-50 text-slate-600 border-slate-200" };
  if (today > endDate) return { label: "종료", color: "bg-zinc-100 text-zinc-500 border-zinc-200" };
  return { label: "투입중", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
};

// 직원의 현재 투입 정보를 assignmentHistory에 누적
// emp: 현재 직원 객체, projectsMap: id→project, options: { closeEndDate?: 오늘로 종료 처리할지 }
export const archiveCurrentAssignment = (emp, projectsMap, options = {}) => {
  // 대기 상태였거나 프로젝트가 없으면 아카이브할 것이 없음
  if (!emp || !emp.projectId || emp.projectId === "pool") return emp.assignmentHistory || [];
  const currentProj = projectsMap[emp.projectId];
  if (!currentProj) return emp.assignmentHistory || [];
  // 같은 프로젝트의 동일 record가 이미 마지막 이력에 있으면 중복 방지
  const history = Array.isArray(emp.assignmentHistory) ? [...emp.assignmentHistory] : [];
  const last = history[history.length - 1];
  const newEntry = {
    id: `h_${emp.id}_${Date.now()}`,
    projectName: currentProj.name,
    startDate: emp.startDate || "",
    endDate: options.closeEndDate ? todayISO() : (emp.endDate || ""),
    assignmentType: emp.assignmentType || "",
    role: emp.role || "",
    duty: emp.duty || "",
  };
  // 마지막 이력이 같은 프로젝트·같은 시작일이면 덮어쓰기 (중복 push 방지)
  if (last && last.projectName === newEntry.projectName && last.startDate === newEntry.startDate) {
    history[history.length - 1] = { ...last, endDate: newEntry.endDate, assignmentType: newEntry.assignmentType, role: newEntry.role, duty: newEntry.duty };
  } else {
    history.push(newEntry);
  }
  return history;
};

// 대기 시작일로부터 오늘까지 경과일/개월 계산
export const calcWaitingDuration = (pooledAt) => {
  if (!pooledAt) return null;
  const start = new Date(pooledAt);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)));
  // 만 개월수 계산 (같은 날짜가 다음 달에 도래해야 1개월)
  let months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  if (today.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);
  return { days, months };
};

// 대기 일수 라벨 포맷팅
export const formatWaitingLabel = (pooledAt) => {
  const d = calcWaitingDuration(pooledAt);
  if (!d) return "";
  if (d.days === 0) return "오늘";
  if (d.days < 30) return `${d.days}일`;
  // 30일 이상은 개월 + 잔여일 표시
  const start = new Date(pooledAt);
  const monthAnchor = new Date(start);
  monthAnchor.setMonth(monthAnchor.getMonth() + d.months);
  const remDays = Math.max(0, Math.floor((new Date(todayISO()) - monthAnchor) / (1000 * 60 * 60 * 24)));
  return remDays > 0 ? `${d.months}개월 ${remDays}일` : `${d.months}개월`;
};

// 샘플 직원 데이터 120명 자동 생성
export const generateSampleData = (projects) => {
  const employees = [];
  const startRange = new Date(2024, 0, 1);
  const midRange = new Date(2025, 6, 1);
  const endRange = new Date(2027, 5, 30);
  const realProjects = projects.filter(p => p.id !== "pool");
  // 대기 기간 분포를 위한 범위: 최근 0~180일 사이
  const today = new Date();
  for (let i = 1; i <= 120; i++) {
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const given = GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
    const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
    const startDate = randomDate(startRange, midRange);
    const endDate = randomDate(new Date(startDate), endRange);
    // 약 60% IBKS, 40% 협력사 비율
    const isPartner = Math.random() < 0.4;
    const affiliation = isPartner ? "협력사" : "IBKS";
    const partnerName = isPartner ? SAMPLE_PARTNERS[Math.floor(Math.random() * SAMPLE_PARTNERS.length)] : "";
    const duty = SAMPLE_DUTIES[Math.floor(Math.random() * SAMPLE_DUTIES.length)];
    const role = SAMPLE_ROLES[Math.floor(Math.random() * SAMPLE_ROLES.length)];
    // 협력사는 절대 대기(pool)에 배정하지 않음 — 비즈니스 규칙: 협력사는 계약 기반 투입
    const candidatePool = isPartner ? realProjects : projects;
    const proj = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    // 대기 인력은 0~180일 전 사이의 랜덤한 날짜로 대기 시작일 부여
    let pooledAt = null;
    if (proj.id === "pool") {
      const daysAgo = Math.floor(Math.random() * 180);
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      pooledAt = d.toISOString().slice(0, 10);
    }
    // 투입 형태: IBKS는 비계약/지원 위주, 협력사는 계약 위주로 가중치 부여
    let assignmentType;
    if (isPartner) {
      assignmentType = Math.random() < 0.85 ? "계약" : "지원";
    } else {
      const r = Math.random();
      assignmentType = r < 0.55 ? "비계약" : r < 0.85 ? "지원" : "계약";
    }

    // 누적 투입 이력 생성 (1~7건)
    // 약 50%의 직원은 4건 이상의 이력을 갖도록 분포 → 스크롤 동작과 일반 동작 균형
    const assignmentHistory = [];
    const historyCount = Math.random() < 0.5
      ? 4 + Math.floor(Math.random() * 4) // 4, 5, 6, 7건
      : 1 + Math.floor(Math.random() * 3); // 1, 2, 3건
    let cursorEnd = new Date(proj.id === "pool" ? pooledAt : startDate);
    for (let h = 0; h < historyCount; h++) {
      const monthsSpan = 3 + Math.floor(Math.random() * 16);
      const histEnd = new Date(cursorEnd);
      const histStart = new Date(histEnd);
      histStart.setMonth(histStart.getMonth() - monthsSpan);
      const histProj = realProjects[Math.floor(Math.random() * realProjects.length)];
      const histType = isPartner
        ? (Math.random() < 0.85 ? "계약" : "지원")
        : (() => { const r = Math.random(); return r < 0.55 ? "비계약" : r < 0.85 ? "지원" : "계약"; })();
      const histRole = SAMPLE_ROLES[Math.floor(Math.random() * SAMPLE_ROLES.length)];
      assignmentHistory.unshift({
        id: `h_${i}_${h}`,
        projectName: histProj.name,
        startDate: histStart.toISOString().slice(0, 10),
        endDate: histEnd.toISOString().slice(0, 10),
        assignmentType: histType,
        role: histRole,
        duty,
      });
      // 다음(더 이전) 이력은 이 이력의 시작일에서 0~6개월 더 전
      const gap = Math.floor(Math.random() * 7);
      cursorEnd = new Date(histStart);
      cursorEnd.setMonth(cursorEnd.getMonth() - gap);
    }

    employees.push({
      id: i, name: `${surname}${given}`, rank, projectId: proj.id, startDate, endDate,
      affiliation, partnerName, duty, role, pooledAt, assignmentType,
      assignmentHistory,
    });
  }
  return employees;
};
