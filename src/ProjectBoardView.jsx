import { useState, useMemo, useRef, useEffect } from "react";
import { Search, Edit2, Trash2, GripVertical, FolderPlus, Building2, Briefcase, UserCheck, Clock, CalendarClock, CheckCircle2, LogOut, Timer, Calendar, Users, Tag, ChevronDown, ChevronRight, ArrowRightLeft, X, Home } from "lucide-react";
import { COLOR_MAP, POOL_SORT_OPTIONS, RANK_ORDER } from "./constants.js";
import { resolveStatus, calcWaitingDuration, formatWaitingLabel, todayISO } from "./helpers.js";

const BOARD_ORDER_KEY = "board-card-orders";
const BOARD_POOL_SORT_KEY = "board-pool-sort";
const BOARD_COLUMN_ORDER_KEY = "board-column-order";
const BOARD_MOBILE_EXPANDED_KEY = "board-mobile-expanded";

const loadOrders = () => {
  try { return JSON.parse(localStorage.getItem(BOARD_ORDER_KEY) || "{}"); }
  catch { return {}; }
};
const loadPoolSort = () => {
  try { return localStorage.getItem(BOARD_POOL_SORT_KEY) || "waitingDays"; }
  catch { return "waitingDays"; }
};
const loadColumnOrder = () => {
  try { return JSON.parse(localStorage.getItem(BOARD_COLUMN_ORDER_KEY) || "null"); }
  catch { return null; }
};
// 모바일 아코디언 펼침 상태 — 저장값이 없으면(최초 방문) 모든 컬럼을 접은 채 시작
const loadMobileExpanded = () => {
  try {
    const raw = localStorage.getItem(BOARD_MOBILE_EXPANDED_KEY);
    if (raw == null) return [];
    return JSON.parse(raw);
  } catch { return []; }
};

// 화면 폭 768px(Tailwind md) 미만이면 모바일로 판단
function useIsMobile() {
  const getMatch = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;
  const [isMobile, setIsMobile] = useState(getMatch);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

// 소속 배지 (이 파일 내부 로컬 컴포넌트)
function AffiliationBadge({ affiliation, partnerName }) {
  if (affiliation === "IBKS") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
        <Building2 size={10} />
        IBKS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border bg-amber-50 text-amber-700 border-amber-200">
      <Building2 size={10} />
      {partnerName || "협력사"}
    </span>
  );
}

const CARD_STATUS_ICONS = { "대기": Clock, "투입예정": CalendarClock, "투입중": CheckCircle2, "철수": LogOut };

// 인력 카드 본문 — 데스크톱/모바일 공용 (드래그/이동 등 래퍼는 각 화면이 담당)
function EmployeeCardContent({ emp, empStatus, isPool, projectById, leading = null, onWithdraw = null, withdrawHoverOnly = false }) {
  const canWithdraw = onWithdraw && (empStatus.label === "투입중" || empStatus.label === "투입예정");
  const CardStatusIcon = CARD_STATUS_ICONS[empStatus.label] || null;
  const isPurePool = emp.projectId === "pool";
  const empProjName = projectById[emp.projectId]?.name;
  const displayStart = !emp.startDate || emp.startDate === "1111-01-01" ? "-" : emp.startDate;
  const displayEnd = !emp.endDate || emp.endDate === "9999-12-31" ? "-" : emp.endDate;

  const waitingLabel = isPurePool ? formatWaitingLabel(emp.pooledAt) : "";
  const waitingDur = isPurePool ? calcWaitingDuration(emp.pooledAt) : null;
  const waitingColor = !waitingDur ? "bg-amber-50 text-amber-700 border-amber-200"
    : waitingDur.days >= 90 ? "bg-red-50 text-red-700 border-red-200"
    : waitingDur.days >= 30 ? "bg-orange-50 text-orange-700 border-orange-200"
    : "bg-amber-50 text-amber-700 border-amber-200";

  const isTipRuYeJeong = empStatus.label === "투입예정" && !isPurePool;
  const pendingBaseDate = isTipRuYeJeong
    ? (emp.startDate && emp.startDate !== "1111-01-01"
        ? emp.startDate
        : emp.created_at ? emp.created_at.slice(0, 10) : null)
    : null;
  const pendingLabel = pendingBaseDate ? formatWaitingLabel(pendingBaseDate) : "";
  const pendingDur = pendingBaseDate ? calcWaitingDuration(pendingBaseDate) : null;
  const pendingColor = !pendingDur ? "bg-amber-50 text-amber-700 border-amber-200"
    : pendingDur.days >= 90 ? "bg-red-50 text-red-700 border-red-200"
    : pendingDur.days >= 30 ? "bg-orange-50 text-orange-700 border-orange-200"
    : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {leading}
          <div className="min-w-0">
            <div className="font-semibold text-sm text-slate-900 truncate">{emp.name}</div>
            <div className="text-xs text-slate-500">{emp.rank}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 font-medium rounded border ${empStatus.color}`}>
            {CardStatusIcon && <CardStatusIcon size={10} />}
            {empStatus.label}
          </span>
          {isPool && waitingLabel && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 font-semibold rounded border ${waitingColor} tabular-nums`}
              title={emp.pooledAt ? `대기 시작: ${emp.pooledAt}` : ""}
            >
              <Timer size={10} />
              {waitingLabel}
            </span>
          )}
          {isTipRuYeJeong && pendingLabel && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 font-semibold rounded border ${pendingColor} tabular-nums`}
              title={pendingBaseDate ? `기산일: ${pendingBaseDate}` : ""}
            >
              <Timer size={10} />
              {pendingLabel}
            </span>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1 min-w-0 overflow-hidden">
        <AffiliationBadge affiliation={emp.affiliation} partnerName={emp.partnerName} />
        {emp.residencyType === "비상주" ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border bg-violet-50 text-violet-700 border-violet-200">
            <Home size={10} />
            비상주
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
            <Building2 size={10} />
            상주
          </span>
        )}
        {emp.duty && emp.duty !== "없음" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border bg-slate-50 text-slate-600 border-slate-200">
            <Briefcase size={10} />
            {emp.duty}
          </span>
        )}
        {emp.role && emp.role !== "없음" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border bg-slate-50 text-slate-600 border-slate-200">
            <UserCheck size={10} />
            {emp.role}
          </span>
        )}
      </div>
      {(empStatus.label === "대기" || emp.assignmentType === "대기") && emp.pooledAt ? (
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 tabular-nums flex justify-between">
          <span className="text-slate-400">대기 시작</span>
          <span>{emp.pooledAt}</span>
        </div>
      ) : empStatus.label === "투입예정" && !isPurePool ? (
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-700 flex justify-between gap-1 min-w-0">
          <span className="text-slate-400 flex-shrink-0">배정 프로젝트</span>
          <span className="font-medium truncate">{empProjName || "-"}</span>
        </div>
      ) : (
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 tabular-nums flex justify-center gap-2">
          <span>{displayStart}</span>
          <span className="text-slate-300">→</span>
          <span>{displayEnd}</span>
        </div>
      )}
      {canWithdraw && (
        <div className={`mt-1.5 flex justify-end ${withdrawHoverOnly ? "opacity-0 group-hover:opacity-100 transition-opacity" : ""}`}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onWithdraw(); }}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-100"
          >
            <LogOut size={11} /> 철수
          </button>
        </div>
      )}
    </>
  );
}

// 프로젝트 컬럼 헤더의 메타 정보(기간/경과/PM/인원/유형) — 데스크톱/모바일 공용
function ProjectMeta({ proj, stats, color }) {
  const typeStyle =
    proj.projectType === "대외 프로젝트"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : proj.projectType === "행내 프로젝트"
      ? "bg-violet-50 text-violet-800 border-violet-200"
      : "bg-emerald-50 text-emerald-800 border-emerald-200";
  return (
    <>
      <div className={`flex flex-col gap-0.5 text-[11px] font-semibold mt-0.5 ${color.text}`}>
        <div className="flex items-center gap-1">
          <Calendar size={10} className="opacity-60 flex-shrink-0" />
          <span className="opacity-80 w-6 flex-shrink-0">기간</span>
          <span className="opacity-40 flex-shrink-0">:</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-slate-50 text-slate-700 border-slate-200 tabular-nums">{proj.startDate || "미정"}</span>
          <span className="opacity-40 text-[9px]">→</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-slate-50 text-slate-700 border-slate-200 tabular-nums">{proj.endDate || "미정"}</span>
        </div>
        {stats.elapsedLabel && (
          <div className="flex items-center gap-1">
            <Clock size={10} className="opacity-60 flex-shrink-0" />
            <span className="opacity-80 w-6 flex-shrink-0">경과</span>
            <span className="opacity-40 flex-shrink-0">:</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-slate-100 text-slate-700 border-slate-300">{stats.elapsedLabel}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Briefcase size={10} className={`flex-shrink-0 ${stats.pmEmp ? "opacity-60" : "text-red-600"}`} />
          <span className={`w-6 flex-shrink-0 ${stats.pmEmp ? "opacity-80" : "text-red-600"}`}>PM</span>
          <span className={`opacity-40 flex-shrink-0 ${stats.pmEmp ? "" : "text-red-600"}`}>:</span>
          {stats.pmEmp
            ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">{stats.pmEmp.name}{stats.pmEmp.rank ? ` ${stats.pmEmp.rank}` : ""}</span>
            : <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-red-50 text-red-600 border-red-200">PM 등록 필수</span>
          }
        </div>
      </div>
      <div className={`flex items-center gap-1 text-[11px] ${color.text} opacity-90 mt-0.5`}>
        <Users size={10} className="flex-shrink-0" />
        <span className="font-semibold flex-shrink-0 w-6">인원</span>
        <span className="opacity-40 flex-shrink-0">:</span>
        <span className="flex flex-wrap gap-1">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-slate-100 text-slate-700 border-slate-300">
            총원 {stats.total}
          </span>
          {stats.ibksCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              IBKS {stats.ibksCount}
            </span>
          )}
          {stats.partnerCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
              협력사 {stats.partnerCount}
            </span>
          )}
          {stats.profCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              교수 {stats.profCount}
            </span>
          )}
        </span>
      </div>
      {proj.projectType && (
        <div className={`flex items-center gap-1 text-[11px] ${color.text} opacity-90 mt-0.5`}>
          <Tag size={10} className="flex-shrink-0" />
          <span className="font-semibold flex-shrink-0 w-6">유형</span>
          <span className="opacity-40 flex-shrink-0">:</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${typeStyle}`}>
            {proj.projectType}
          </span>
        </div>
      )}
    </>
  );
}

// props:
//   employees        — 전체 직원 목록
//   projects         — 전체 프로젝트 목록
//   onDropEmployee   — (empId, projId) 드롭 시 employees 상태 변경 (부모 처리)
//   onCardClick      — (emp) 직원 카드 클릭 시 상세 팝업 열기
//   onNewProject     — 프로젝트 등록 모달 열기
//   onEditProject    — (proj) 프로젝트 수정 모달 열기
//   onDeleteProject  — (projId) 프로젝트 삭제
export default function ProjectBoardView({
  employees, projects,
  onDropEmployee, onCardClick, onEditEmp, onWithdraw,
  onNewProject, onEditProject, onDeleteProject,
}) {
  const isMobile = useIsMobile();
  const [boardQuery, setBoardQuery] = useState("");
  const [filterBoardType, setFilterBoardType] = useState("전체");
  const [dragId, setDragId] = useState(null);
  const [dragOverProj, setDragOverProj] = useState(null);
  const [poolSortField, setPoolSortFieldState] = useState(loadPoolSort);
  const [poolSortDir, setPoolSortDir] = useState("desc");
  // 컬럼 내 카드 순서 관련 상태
  const [columnOrders, setColumnOrders] = useState(loadOrders);
  const [dragOverCard, setDragOverCard] = useState(null); // { empId, above }
  const [columnOrder, setColumnOrder] = useState(loadColumnOrder);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  // 모바일 전용 상태
  const [mobileExpanded, setMobileExpanded] = useState(loadMobileExpanded);
  const [moveTarget, setMoveTarget] = useState(null); // { emp, srcColId }
  const [withdrawTarget, setWithdrawTarget] = useState(null); // 철수 대상 emp
  // ref 사용: 이벤트 핸들러에서 최신 값 참조 (stale closure 방지)
  const dragSourceColRef = useRef(null);
  const columnMembersRef = useRef({});
  const draggingColumnRef = useRef(null);

  const setPoolSortField = (val) => {
    localStorage.setItem(BOARD_POOL_SORT_KEY, val);
    setPoolSortFieldState(val);
  };

  const saveColumnOrder = (colId, ids) => {
    setColumnOrders(prev => {
      const next = { ...prev, [colId]: ids };
      localStorage.setItem(BOARD_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleMobileExpand = (colId) => {
    setMobileExpanded(prev => {
      const next = prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId];
      localStorage.setItem(BOARD_MOBILE_EXPANDED_KEY, JSON.stringify(next));
      return next;
    });
  };

  // savedOrder 순서 기준으로 members 정렬, 순서에 없는 항목은 뒤에 추가
  const applyColumnOrder = (members, colId) => {
    const savedOrder = columnOrders[colId];
    if (!savedOrder || savedOrder.length === 0) return members;
    const memberMap = Object.fromEntries(members.map(m => [m.id, m]));
    const ordered = savedOrder.filter(id => memberMap[id]).map(id => memberMap[id]);
    const rest = members.filter(m => !savedOrder.includes(m.id));
    return [...ordered, ...rest];
  };

  // 현재 컬럼의 저장 순서 배열 반환 (저장된 순서 + 미포함 항목 후방 추가)
  const getBaseOrder = (colId, currentIds) => {
    const savedOrder = columnOrders[colId] || [];
    const savedFiltered = savedOrder.filter(id => currentIds.includes(id));
    const unsaved = currentIds.filter(id => !savedOrder.includes(id));
    return [...savedFiltered, ...unsaved];
  };

  const projectById = Object.fromEntries(projects.map(p => [p.id, p]));
  const empStatuses = Object.fromEntries(
    employees.map(e => [e.id, resolveStatus(e, projectById[e.projectId]?.name)])
  );

  // ── 드래그 핸들러 (데스크톱 칸반) ──────────────────────────

  const handleDragStart = (e, empId, colId) => {
    setDragId(empId);
    dragSourceColRef.current = colId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(empId));
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverProj(null);
    setDragOverCard(null);
    dragSourceColRef.current = null;
  };

  const handleDragOver = (e, projId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverProj !== projId) setDragOverProj(projId);
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverProj(null);
    setDragOverCard(null);
    setDragOverColumn(null);
  };

  const handleDrop = (e, projId) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/plain"));
    const srcCol = dragSourceColRef.current;
    setDragId(null);
    setDragOverProj(null);
    setDragOverCard(null);
    dragSourceColRef.current = null;

    if (Number.isNaN(id)) return;
    if (srcCol === projId) return; // 같은 컬럼 빈 공간에 드롭: 무시

    const draggedEmp = employees.find(x => x.id === id);
    const isTargetPool = projId === "pool";

    // 대기 → 프로젝트: 수정 모달 자동 오픈 (투입 프로젝트 미리 선택)
    if (srcCol === "pool" && !isTargetPool) {
      if (draggedEmp && onEditEmp) onEditEmp({ ...draggedEmp, projectId: projId });
      return;
    }

    onDropEmployee(id, projId);
    if (srcCol) {
      saveColumnOrder(srcCol, (columnOrders[srcCol] || []).filter(oid => oid !== id));
    }
  };

  const handleCardDragOver = (e, targetEmpId, colId) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverProj !== colId) setDragOverProj(colId);

    const rect = e.currentTarget.getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    if (!dragOverCard || dragOverCard.empId !== targetEmpId || dragOverCard.above !== above) {
      setDragOverCard({ empId: targetEmpId, above });
    }
  };

  const handleCardDrop = (e, targetEmpId, targetColId) => {
    e.preventDefault();
    e.stopPropagation();

    const id = Number(e.dataTransfer.getData("text/plain"));
    const srcCol = dragSourceColRef.current;
    const insertAbove = dragOverCard?.above ?? true;

    setDragId(null);
    setDragOverProj(null);
    setDragOverCard(null);
    dragSourceColRef.current = null;

    if (Number.isNaN(id) || id === targetEmpId) return;

    const draggedEmp = employees.find(x => x.id === id);
    const isTargetPool = targetColId === "pool";

    if (srcCol === "pool" && !isTargetPool) {
      if (draggedEmp && onEditEmp) onEditEmp({ ...draggedEmp, projectId: targetColId });
      return;
    }

    if (srcCol === targetColId) {
      // ── 같은 컬럼: 순서 변경 ──
      const members = columnMembersRef.current[targetColId] || [];
      const currentIds = members.map(m => m.id);
      const baseOrder = getBaseOrder(targetColId, currentIds);

      const withoutDragged = baseOrder.filter(i => i !== id);
      const tIdx = withoutDragged.indexOf(targetEmpId);
      if (tIdx === -1) return;

      const newOrder = [...withoutDragged];
      newOrder.splice(insertAbove ? tIdx : tIdx + 1, 0, id);
      saveColumnOrder(targetColId, newOrder);
      if (targetColId === "pool") setPoolSortField("manual");
    } else {
      // ── 다른 컬럼: 컬럼 간 이동 + 삽입 위치 저장 ──
      onDropEmployee(id, targetColId);

      if (srcCol) {
        saveColumnOrder(srcCol, (columnOrders[srcCol] || []).filter(oid => oid !== id));
      }

      const targetMembers = columnMembersRef.current[targetColId] || [];
      const targetCurrentIds = targetMembers.map(m => m.id).filter(i => i !== id);
      const baseTargetOrder = getBaseOrder(targetColId, targetCurrentIds);

      const tIdx = baseTargetOrder.indexOf(targetEmpId);
      const insertAt = tIdx !== -1 ? (insertAbove ? tIdx : tIdx + 1) : baseTargetOrder.length;
      const newTargetOrder = [...baseTargetOrder];
      newTargetOrder.splice(insertAt, 0, id);
      saveColumnOrder(targetColId, newTargetOrder);
    }
  };

  // ── 모바일 이동 핸들러 (드래그 대체: 탭 → 바텀시트) ─────────
  const handleMobileMove = (emp, srcColId, targetProjId) => {
    if (srcColId === targetProjId) { setMoveTarget(null); return; }
    const isTargetPool = targetProjId === "pool";

    // 대기 → 프로젝트: 수정 모달 자동 오픈 (드래그와 동일 동작)
    if (srcColId === "pool" && !isTargetPool) {
      if (onEditEmp) onEditEmp({ ...emp, projectId: targetProjId });
      setMoveTarget(null);
      return;
    }

    onDropEmployee(emp.id, targetProjId);
    if (srcColId) {
      saveColumnOrder(srcColId, (columnOrders[srcColId] || []).filter(oid => oid !== emp.id));
    }
    setMoveTarget(null);
  };

  const orderedProjects = useMemo(() => {
    if (!columnOrder || columnOrder.length === 0) return projects;
    const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
    const ordered = columnOrder.filter(id => projMap[id]).map(id => projMap[id]);
    const rest = projects.filter(p => !columnOrder.includes(p.id));
    return [...ordered, ...rest];
  }, [projects, columnOrder]);

  // ── 공통 컬럼 데이터 계산 (데스크톱/모바일 공유) ───────────
  const columns = orderedProjects
    .filter(proj => proj.id === "pool" || filterBoardType === "전체" || proj.projectType === filterBoardType)
    .map((proj) => {
      const q = boardQuery.trim().toLowerCase();
      const isPool = proj.id === "pool";

      const matchesSearch = (e) => !q
        || e.name.toLowerCase().includes(q)
        || e.rank.toLowerCase().includes(q)
        || (e.partnerName || "").toLowerCase().includes(q)
        || (e.duty || "").toLowerCase().includes(q)
        || (e.role || "").toLowerCase().includes(q);

      let members = isPool
        ? employees.filter(e => (e.projectId === "pool" || e.projectId == null || empStatuses[e.id]?.label === "투입예정") && matchesSearch(e))
        : employees.filter(e => e.projectId === proj.id && empStatuses[e.id]?.label !== "투입예정" && matchesSearch(e));

      if (isPool) {
        if (poolSortField === "manual") {
          members = applyColumnOrder(members, "pool");
        } else {
          const dirMul = poolSortDir === "asc" ? 1 : -1;
          members = [...members].sort((a, b) => {
            let va, vb;
            switch (poolSortField) {
              case "waitingDays":
                va = a.pooledAt || "9999-12-31";
                vb = b.pooledAt || "9999-12-31";
                if (va < vb) return 1 * dirMul;
                if (va > vb) return -1 * dirMul;
                return (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
              case "rank":
                va = RANK_ORDER[a.rank] ?? 99;
                vb = RANK_ORDER[b.rank] ?? 99;
                break;
              case "duty":
                va = (a.duty || "ㅎ").toLowerCase();
                vb = (b.duty || "ㅎ").toLowerCase();
                break;
              case "name":
                va = a.name; vb = b.name;
                break;
              case "startDate":
                va = a.startDate || ""; vb = b.startDate || "";
                break;
              case "added":
                va = a.id; vb = b.id;
                break;
              case "endDate":
              default:
                va = a.endDate || ""; vb = b.endDate || "";
            }
            if (va < vb) return -1 * dirMul;
            if (va > vb) return 1 * dirMul;
            return (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
          });
        }
      } else {
        members = applyColumnOrder(members, proj.id);
      }

      // 이벤트 핸들러(드래그)에서 참조할 수 있도록 ref 저장
      columnMembersRef.current[proj.id] = members;

      // ── 통계 계산 ──
      let stats;
      if (isPool) {
        const empCount = members.filter(m => m.rank !== "교수").length;
        const profCount = members.filter(m => m.rank === "교수").length;
        const getPendingBase = (m) => {
          if (m.pooledAt) return m.pooledAt;
          if (empStatuses[m.id]?.label === "투입예정" && m.projectId !== "pool") {
            return (m.startDate && m.startDate !== "1111-01-01")
              ? m.startDate
              : m.created_at?.slice(0, 10) ?? null;
          }
          return null;
        };
        const withDates = members.filter(m => getPendingBase(m));
        let avgWait = null, maxWait = null;
        if (withDates.length > 0) {
          const durations = withDates.map(m => calcWaitingDuration(getPendingBase(m))?.days ?? 0);
          avgWait = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
          maxWait = Math.max(...durations);
        }
        stats = { empCount, profCount, avgWait, maxWait, hasWaitData: withDates.length > 0 };
      } else {
        const pmEmp = members.find(m => m.duty === "PM");
        let elapsedLabel = null;
        if (proj.startDate) {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const diffDays = Math.round((today - new Date(proj.startDate)) / 86400000);
          elapsedLabel = diffDays >= 0 ? `D+${diffDays}` : `D${diffDays}`;
        }
        stats = {
          pmEmp,
          elapsedLabel,
          total: members.length,
          ibksCount: members.filter(m => m.affiliation === "IBKS" && m.rank !== "교수").length,
          profCount: members.filter(m => m.affiliation === "IBKS" && m.rank === "교수").length,
          partnerCount: members.filter(m => m.affiliation === "협력사").length,
        };
      }

      return { proj, isPool, members, stats };
    });

  const draggedEmp = dragId !== null ? employees.find(x => x.id === dragId) : null;

  // ── 검색/필터 바 (데스크톱·모바일 공용) ───────────────────
  const SearchBar = (
    <div className="bg-white rounded-lg border border-slate-200 p-2 sm:p-3 mb-0 flex-shrink-0">
      <div className="flex gap-2 items-center">
        <select
          value={filterBoardType}
          onChange={(e) => setFilterBoardType(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
        >
          <option value="전체">유형 전체</option>
          <option value="대외 프로젝트">대외 프로젝트</option>
          <option value="행내 프로젝트">행내 프로젝트</option>
          <option value="사내 프로젝트">사내 프로젝트</option>
        </select>
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="직원명, 직급, 협력사명"
            value={boardQuery}
            onChange={(e) => setBoardQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {filterBoardType !== "전체" && (
          <span className="text-xs text-violet-600 font-medium flex-shrink-0 hidden sm:inline">· 유형 필터 적용 중</span>
        )}
        <button
          onClick={onNewProject}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1 font-medium flex-shrink-0"
        >
          <FolderPlus size={14} /> <span className="hidden sm:inline">프로젝트 </span>등록
        </button>
      </div>
      <div className="mt-1 text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5">
        {isMobile ? (
          <>
            <ArrowRightLeft size={12} className="flex-shrink-0" />
            <span>헤더를 눌러 펼치고, 카드의 “이동” 버튼으로 인력을 재배치하세요.</span>
          </>
        ) : (
          <>
            <GripVertical size={12} className="flex-shrink-0" />
            <span>카드를 드래그하여 다른 컬럼으로 이동하거나, 같은 컬럼 내에서 순서를 변경할 수 있습니다.</span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {SearchBar}
      {isMobile ? (
        <MobileAccordionBoard
          columns={columns}
          projectById={projectById}
          empStatuses={empStatuses}
          mobileExpanded={mobileExpanded}
          toggleMobileExpand={toggleMobileExpand}
          poolSortField={poolSortField}
          setPoolSortField={setPoolSortField}
          poolSortDir={poolSortDir}
          setPoolSortDir={setPoolSortDir}
          onCardClick={onCardClick}
          onEditProject={onEditProject}
          onDeleteProject={onDeleteProject}
          onRequestMove={(emp, srcColId) => setMoveTarget({ emp, srcColId })}
          onRequestWithdraw={(emp) => setWithdrawTarget(emp)}
        />
      ) : (
        <DesktopKanbanBoard
          columns={columns}
          projectById={projectById}
          empStatuses={empStatuses}
          orderedProjects={orderedProjects}
          dragId={dragId}
          dragOverProj={dragOverProj}
          dragOverCard={dragOverCard}
          dragOverColumn={dragOverColumn}
          draggingColumnRef={draggingColumnRef}
          draggedEmp={draggedEmp}
          poolSortField={poolSortField}
          setPoolSortField={setPoolSortField}
          poolSortDir={poolSortDir}
          setPoolSortDir={setPoolSortDir}
          setDragOverColumn={setDragOverColumn}
          setColumnOrder={setColumnOrder}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          handleDragStart={handleDragStart}
          handleDragEnd={handleDragEnd}
          handleCardDragOver={handleCardDragOver}
          handleCardDrop={handleCardDrop}
          onCardClick={onCardClick}
          onEditProject={onEditProject}
          onDeleteProject={onDeleteProject}
          onRequestWithdraw={(emp) => setWithdrawTarget(emp)}
        />
      )}

      {/* 모바일 인력 이동 바텀시트 */}
      {moveTarget && (
        <MoveBottomSheet
          moveTarget={moveTarget}
          projects={orderedProjects}
          projectById={projectById}
          onSelect={(targetProjId) => handleMobileMove(moveTarget.emp, moveTarget.srcColId, targetProjId)}
          onClose={() => setMoveTarget(null)}
        />
      )}

      {/* 철수 확인 모달 */}
      {withdrawTarget && (
        <WithdrawModal
          emp={withdrawTarget}
          onConfirm={(endDate) => { onWithdraw(withdrawTarget.id, endDate); setWithdrawTarget(null); }}
          onClose={() => setWithdrawTarget(null)}
        />
      )}
    </div>
  );
}

// ── 데스크톱 가로 칸반 ──────────────────────────────────────
function DesktopKanbanBoard({
  columns, projectById, empStatuses, orderedProjects,
  dragId, dragOverProj, dragOverCard, dragOverColumn, draggingColumnRef, draggedEmp,
  poolSortField, setPoolSortField, poolSortDir, setPoolSortDir,
  setDragOverColumn, setColumnOrder,
  handleDragOver, handleDragLeave, handleDrop,
  handleDragStart, handleDragEnd, handleCardDragOver, handleCardDrop,
  onCardClick, onEditProject, onDeleteProject, onRequestWithdraw,
}) {
  return (
    <div className="flex-1 overflow-auto min-h-0 mt-1.5" style={{ minWidth: 0 }}>
      <div className="flex gap-2 sm:gap-3 pb-4 items-start" style={{ minWidth: "max-content" }}>
        {columns.map(({ proj, isPool, members, stats }) => {
          const c = COLOR_MAP[proj.color] || COLOR_MAP.slate;
          const isOver = dragOverProj === proj.id;
          const isColumnOver = dragOverColumn === proj.id
            && draggingColumnRef.current !== null
            && String(draggingColumnRef.current) !== String(proj.id);
          const isPartnerDropWarning = isPool && isOver && draggedEmp?.affiliation === "협력사";

          return (
            <div
              key={proj.id}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/proj-id")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverColumn !== proj.id) setDragOverColumn(proj.id);
                  return;
                }
                handleDragOver(e, proj.id);
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                if (e.dataTransfer.types.includes("application/proj-id")) {
                  e.preventDefault();
                  const srcId = draggingColumnRef.current ?? e.dataTransfer.getData("application/proj-id");
                  setDragOverColumn(null);
                  if (srcId == null || String(srcId) === String(proj.id)) return;

                  const currentOrder = orderedProjects.map(p => p.id);
                  const fromIdx = currentOrder.findIndex(id => String(id) === String(srcId));
                  const toIdx   = currentOrder.findIndex(id => String(id) === String(proj.id));
                  if (fromIdx === -1 || toIdx === -1) return;

                  const newOrder = [...currentOrder];
                  newOrder.splice(fromIdx, 1);
                  newOrder.splice(toIdx, 0, currentOrder[fromIdx]);
                  localStorage.setItem(BOARD_COLUMN_ORDER_KEY, JSON.stringify(newOrder));
                  setColumnOrder(newOrder);
                  return;
                }
                handleDrop(e, proj.id);
              }}
              className={`flex-shrink-0 w-64 sm:w-72 rounded-lg border-2 ${
                isPartnerDropWarning ? "border-red-400 bg-red-50/40" :
                isColumnOver ? "border-amber-400 bg-amber-50/30" :
                isOver ? "border-indigo-400 bg-indigo-50/30" :
                `${c.border} ${c.bg}`
              } transition-colors`}
            >
              {/* 컬럼 헤더 */}
              <div
                className={`px-3 py-2.5 border-b ${c.border} ${c.header} rounded-t-md cursor-grab active:cursor-grabbing`}
                draggable
                onDragStart={(e) => {
                  draggingColumnRef.current = proj.id;
                  e.dataTransfer.setData("application/proj-id", proj.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.stopPropagation();
                }}
                onDragEnd={(e) => {
                  draggingColumnRef.current = null;
                  setDragOverColumn(null);
                  e.stopPropagation();
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${c.dot} flex-shrink-0`}></span>
                    <span className={`font-bold text-sm ${c.text} truncate`} title={proj.name}>
                      {proj.name}
                    </span>
                  </div>
                  {isPool ? (
                    (stats.empCount > 0 || stats.profCount > 0) ? (
                      <span className="flex items-center gap-1 flex-shrink-0">
                        {stats.empCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-blue-50 text-blue-700 border-blue-200">
                            직원 {stats.empCount}
                          </span>
                        )}
                        {stats.profCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-purple-50 text-purple-700 border-purple-200">
                            교수 {stats.profCount}
                          </span>
                        )}
                      </span>
                    ) : null
                  ) : (
                    <div className="flex gap-0.5 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); onEditProject(proj); }} className={`p-1 rounded hover:bg-white/70 ${c.text}`} title="프로젝트 수정"><Edit2 size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteProject(proj.id); }} className="p-1 rounded hover:bg-white/70 text-slate-500 hover:text-red-600" title="프로젝트 삭제"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                {!isPool && <ProjectMeta proj={proj} stats={stats} color={c} />}
              </div>

              {/* 대기 컬럼 안내 + 통계 */}
              {isPool && (
                <div className={`px-3 py-1.5 text-[11px] border-b ${c.border} ${
                  isPartnerDropWarning ? "bg-red-100 text-red-700 font-semibold" : "bg-white/50 text-slate-600"
                }`}>
                  {isPartnerDropWarning ? (
                    "⚠ 협력사 직원은 대기로 이동 시 자동 삭제됩니다"
                  ) : !stats.hasWaitData ? "대기 인력이 없습니다" : (
                    <div className="flex items-center justify-between gap-2 tabular-nums">
                      <span className="text-slate-500">평균 <span className="font-bold text-slate-700">{stats.avgWait}</span>일</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">최장 <span className={`font-bold ${stats.maxWait >= 90 ? "text-red-600" : stats.maxWait >= 30 ? "text-orange-600" : "text-slate-700"}`}>{stats.maxWait}</span>일</span>
                    </div>
                  )}
                </div>
              )}

              {/* 대기 컬럼 정렬 컨트롤 */}
              {isPool && (
                <PoolSortControls
                  color={c}
                  poolSortField={poolSortField}
                  setPoolSortField={setPoolSortField}
                  poolSortDir={poolSortDir}
                  setPoolSortDir={setPoolSortDir}
                />
              )}

              {/* 카드 목록 */}
              <div className="p-2 space-y-2">
                {members.length === 0 && (
                  <div className="text-center text-xs text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-md min-h-[80px] flex items-center justify-center">
                    {isOver ? (isPartnerDropWarning ? "여기 놓으면 자동 삭제" : "여기에 놓기") : "배치된 인원 없음"}
                  </div>
                )}
                {members.map((emp) => {
                  const empStatus = empStatuses[emp.id] || { label: "대기", color: "bg-slate-100 text-slate-600 border-slate-300" };
                  const isDragging = dragId === emp.id;
                  const showIndicatorAbove = dragOverCard?.empId === emp.id && dragOverCard?.above;
                  const showIndicatorBelow = dragOverCard?.empId === emp.id && !dragOverCard?.above;

                  return (
                    <div key={emp.id}>
                      {showIndicatorAbove && (
                        <div className="h-0.5 bg-indigo-500 rounded mx-0.5 mb-1.5" />
                      )}
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, emp.id, proj.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleCardDragOver(e, emp.id, proj.id)}
                        onDrop={(e) => handleCardDrop(e, emp.id, proj.id)}
                        onClick={() => onCardClick(emp)}
                        className={`group bg-white rounded-md border border-slate-200 p-2.5 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all select-none min-w-0 ${isDragging ? "opacity-40 scale-95" : ""}`}
                        title="클릭하여 상세 보기"
                      >
                        <EmployeeCardContent
                          emp={emp}
                          empStatus={empStatus}
                          isPool={isPool}
                          projectById={projectById}
                          leading={<GripVertical size={12} className="text-slate-300 flex-shrink-0 cursor-grab active:cursor-grabbing" />}
                          onWithdraw={() => onRequestWithdraw(emp)}
                          withdrawHoverOnly
                        />
                      </div>
                      {showIndicatorBelow && (
                        <div className="h-0.5 bg-indigo-500 rounded mx-0.5 mt-1.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 모바일 세로 아코디언 ────────────────────────────────────
function MobileAccordionBoard({
  columns, projectById, empStatuses,
  mobileExpanded, toggleMobileExpand,
  poolSortField, setPoolSortField, poolSortDir, setPoolSortDir,
  onCardClick, onEditProject, onDeleteProject, onRequestMove, onRequestWithdraw,
}) {
  return (
    <div className="flex-1 overflow-auto min-h-0 mt-1.5 space-y-2 pb-4">
      {columns.map(({ proj, isPool, members, stats }) => {
        const c = COLOR_MAP[proj.color] || COLOR_MAP.slate;
        const expanded = mobileExpanded.includes(proj.id);

        return (
          <div key={proj.id} className={`rounded-lg border ${c.border} ${c.bg} overflow-hidden`}>
            {/* 헤더 (탭하여 펼침/접힘) */}
            <button
              type="button"
              onClick={() => toggleMobileExpand(proj.id)}
              className={`w-full text-left px-3 py-2.5 ${c.header} ${isPool ? "" : "border-b " + c.border}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {expanded
                    ? <ChevronDown size={16} className={`flex-shrink-0 ${c.text}`} />
                    : <ChevronRight size={16} className={`flex-shrink-0 ${c.text}`} />}
                  <span className={`w-2.5 h-2.5 rounded-full ${c.dot} flex-shrink-0`}></span>
                  <span className={`font-bold text-sm ${c.text} truncate`}>{proj.name}</span>
                </div>
                {isPool ? (
                  (stats.empCount > 0 || stats.profCount > 0) ? (
                    <span className="flex items-center gap-1 flex-shrink-0">
                      {stats.empCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-blue-50 text-blue-700 border-blue-200">직원 {stats.empCount}</span>
                      )}
                      {stats.profCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-purple-50 text-purple-700 border-purple-200">교수 {stats.profCount}</span>
                      )}
                    </span>
                  ) : null
                ) : (
                  <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-slate-100 text-slate-700 border-slate-300 mr-0.5">총원 {stats.total}</span>
                    <button onClick={(e) => { e.stopPropagation(); onEditProject(proj); }} className={`p-1 rounded hover:bg-white/70 ${c.text}`} title="프로젝트 수정"><Edit2 size={13} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteProject(proj.id); }} className="p-1 rounded hover:bg-white/70 text-slate-500 hover:text-red-600" title="프로젝트 삭제"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
              {/* 접힘 상태에서도 보이는 핵심 요약 */}
              {!isPool && (
                <div className={`mt-1 flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] ${c.text} opacity-90`}>
                  <span className="inline-flex items-center gap-1">
                    <Briefcase size={10} className={stats.pmEmp ? "opacity-60" : "text-red-600"} />
                    {stats.pmEmp
                      ? <span className="font-semibold">{stats.pmEmp.name}{stats.pmEmp.rank ? ` ${stats.pmEmp.rank}` : ""}</span>
                      : <span className="text-red-600 font-semibold">PM 등록 필수</span>}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Calendar size={10} className="opacity-60" />
                    {proj.startDate || "미정"} → {proj.endDate || "미정"}
                  </span>
                  {proj.projectType && (
                    <span className="inline-flex items-center gap-1"><Tag size={10} className="opacity-60" />{proj.projectType}</span>
                  )}
                </div>
              )}
              {isPool && stats.hasWaitData && (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600 tabular-nums">
                  <span>평균 <span className="font-bold text-slate-700">{stats.avgWait}</span>일</span>
                  <span className="text-slate-300">·</span>
                  <span>최장 <span className={`font-bold ${stats.maxWait >= 90 ? "text-red-600" : stats.maxWait >= 30 ? "text-orange-600" : "text-slate-700"}`}>{stats.maxWait}</span>일</span>
                </div>
              )}
            </button>

            {expanded && (
              <div>
                {/* 프로젝트 상세 메타 */}
                {!isPool && (
                  <div className={`px-3 py-2 border-b ${c.border} bg-white/40`}>
                    <ProjectMeta proj={proj} stats={stats} color={c} />
                  </div>
                )}
                {/* 대기 정렬 컨트롤 */}
                {isPool && (
                  <PoolSortControls
                    color={c}
                    poolSortField={poolSortField}
                    setPoolSortField={setPoolSortField}
                    poolSortDir={poolSortDir}
                    setPoolSortDir={setPoolSortDir}
                  />
                )}

                <div className="p-2 space-y-2">
                  {members.length === 0 && (
                    <div className="text-center text-xs text-slate-400 py-6 border-2 border-dashed border-slate-200 rounded-md">
                      배치된 인원 없음
                    </div>
                  )}
                  {members.map((emp) => {
                    const empStatus = empStatuses[emp.id] || { label: "대기", color: "bg-slate-100 text-slate-600 border-slate-300" };
                    return (
                      <div
                        key={emp.id}
                        onClick={() => onCardClick(emp)}
                        className="bg-white rounded-md border border-slate-200 p-2.5 shadow-sm active:bg-slate-50 cursor-pointer transition-all min-w-0"
                      >
                        <EmployeeCardContent
                          emp={emp}
                          empStatus={empStatus}
                          isPool={isPool}
                          projectById={projectById}
                        />
                        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end gap-1.5">
                          {(empStatus.label === "투입중" || empStatus.label === "투입예정") && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onRequestWithdraw(emp); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-blue-200 bg-blue-50 text-blue-700 active:bg-blue-100"
                            >
                              <LogOut size={12} /> 철수
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onRequestMove(emp, proj.id); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-indigo-200 bg-indigo-50 text-indigo-700 active:bg-indigo-100"
                          >
                            <ArrowRightLeft size={12} /> 이동
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 대기 컬럼 정렬 컨트롤 (공용) ────────────────────────────
function PoolSortControls({ color, poolSortField, setPoolSortField, poolSortDir, setPoolSortDir }) {
  return (
    <div className={`px-2 py-1.5 border-b ${color.border} bg-white/40 flex items-center gap-1`}>
      <span className="text-[10px] font-semibold text-slate-500 flex-shrink-0">정렬</span>
      <select
        value={poolSortField}
        onChange={(e) => setPoolSortField(e.target.value)}
        className="flex-1 min-w-0 px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {POOL_SORT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {poolSortField !== "manual" && (
        <button
          onClick={() => setPoolSortDir(poolSortDir === "asc" ? "desc" : "asc")}
          className="px-2 py-1 text-[11px] border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-700 flex-shrink-0 font-semibold"
          title={poolSortDir === "asc" ? "오름차순" : "내림차순"}
        >
          {poolSortDir === "asc" ? "↑" : "↓"}
        </button>
      )}
    </div>
  );
}

// ── 모바일 인력 이동 바텀시트 ───────────────────────────────
function MoveBottomSheet({ moveTarget, projects, projectById, onSelect, onClose }) {
  const { emp, srcColId } = moveTarget;
  const isPartner = emp.affiliation === "협력사";
  const targets = projects.filter(p => p.id !== srcColId);
  const srcName = projectById[srcColId]?.name || "대기";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-2xl max-h-[75vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">{emp.name} {emp.rank}</div>
            <div className="text-[11px] text-slate-500">현재: {srcName} · 이동할 프로젝트 선택</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 flex-shrink-0" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto p-2 space-y-1">
          {targets.map((p) => {
            const isPool = p.id === "pool";
            const warn = isPool && isPartner;
            const c = COLOR_MAP[p.color] || COLOR_MAP.slate;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className={`w-full text-left px-3 py-2.5 rounded-md border flex items-center justify-between gap-2 ${
                  warn ? "border-red-200 bg-red-50 active:bg-red-100" : "border-slate-200 bg-white active:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${c.dot} flex-shrink-0`}></span>
                  <span className="text-sm font-medium text-slate-800 truncate">{p.name}</span>
                </span>
                {warn
                  ? <span className="text-[10px] font-semibold text-red-600 flex-shrink-0">⚠ 이동 시 자동 삭제</span>
                  : <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400 flex-shrink-0">
          {srcColId === "pool"
            ? "대기 → 프로젝트 이동 시 투입 정보 입력 창이 열립니다."
            : "선택 즉시 이동이 적용됩니다."}
        </div>
      </div>
    </div>
  );
}

// 철수 확인 모달 — 철수일자 선택 + (협력사) 삭제 경고
function WithdrawModal({ emp, onConfirm, onClose }) {
  const [endDate, setEndDate] = useState(todayISO());
  const isPartner = emp.affiliation === "협력사";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-xl w-full max-w-sm shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-bold text-slate-900">철수 처리</div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">{emp.name}({emp.rank})</span>님을 철수 처리합니다.
            {!isPartner && " 철수 후 대기로 이동합니다."}
          </p>
          <div>
            <label className="block text-[12px] font-medium text-slate-600 mb-1">철수일자</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {isPartner && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              협력사 직원은 철수 시 목록에서 삭제되며 되돌릴 수 없습니다. 투입 이력은 보존됩니다.
            </p>
          )}
        </div>
        <div className="flex border-t border-slate-200">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">취소</button>
          <div className="w-px bg-slate-200" />
          <button
            onClick={() => onConfirm(endDate)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${isPartner ? "text-red-600 hover:bg-red-50" : "text-blue-600 hover:bg-blue-50"}`}
          >
            {isPartner ? "철수 후 삭제" : "철수"}
          </button>
        </div>
      </div>
    </div>
  );
}
