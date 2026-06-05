import { useState, useMemo, useRef } from "react";
import { Search, Edit2, Trash2, GripVertical, FolderPlus, Building2, Briefcase, UserCheck, Clock, CalendarClock, CheckCircle2, LogOut, Timer, Calendar } from "lucide-react";
import { COLOR_MAP, POOL_SORT_OPTIONS, RANK_ORDER } from "./constants.js";
import { resolveStatus, calcWaitingDuration, formatWaitingLabel } from "./helpers.js";

const BOARD_ORDER_KEY = "board-card-orders";
const BOARD_POOL_SORT_KEY = "board-pool-sort";
const loadOrders = () => {
  try { return JSON.parse(localStorage.getItem(BOARD_ORDER_KEY) || "{}"); }
  catch { return {}; }
};
const loadPoolSort = () => {
  try { return localStorage.getItem(BOARD_POOL_SORT_KEY) || "waitingDays"; }
  catch { return "waitingDays"; }
};

const BOARD_COLUMN_ORDER_KEY = "board-column-order";
const loadColumnOrder = () => {
  try { return JSON.parse(localStorage.getItem(BOARD_COLUMN_ORDER_KEY) || "null"); }
  catch { return null; }
};

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
  onDropEmployee, onCardClick, onEditEmp,
  onNewProject, onEditProject, onDeleteProject,
}) {
  const [boardQuery, setBoardQuery] = useState("");
  const [dragId, setDragId] = useState(null);
  const [dragOverProj, setDragOverProj] = useState(null);
  const [poolSortField, setPoolSortFieldState] = useState(loadPoolSort);
  const [poolSortDir, setPoolSortDir] = useState("desc");
  // 컬럼 내 카드 순서 관련 상태
  const [columnOrders, setColumnOrders] = useState(loadOrders);
  const [dragOverCard, setDragOverCard] = useState(null); // { empId, above }
  const [columnOrder, setColumnOrder] = useState(loadColumnOrder);
  const [dragOverColumn, setDragOverColumn] = useState(null);
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

  // ── 드래그 핸들러 ──────────────────────────────────────────

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

  // 컬럼 영역 dragover (빈 공간이나 카드 없는 컬럼)
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

  // 컬럼 영역 drop (빈 공간에 드롭 — 컬럼 간 이동)
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
    // 원본 컬럼 순서에서 제거
    if (srcCol) {
      saveColumnOrder(srcCol, (columnOrders[srcCol] || []).filter(oid => oid !== id));
    }
  };

  // 카드 위 dragover (삽입 위치 계산)
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

  // 카드 위 drop (같은 컬럼: 순서 변경 / 다른 컬럼: 컬럼 간 이동)
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

    // 대기 → 프로젝트: 수정 모달 자동 오픈 (투입 프로젝트 미리 선택)
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
      // 대기 컬럼에서 수동 정렬 시 자동으로 수동 정렬 모드로 전환
      if (targetColId === "pool") setPoolSortField("manual");
    } else {
      // ── 다른 컬럼: 컬럼 간 이동 + 삽입 위치 저장 ──
      onDropEmployee(id, targetColId);

      // 원본 컬럼 순서에서 제거
      if (srcCol) {
        saveColumnOrder(srcCol, (columnOrders[srcCol] || []).filter(oid => oid !== id));
      }

      // 대상 컬럼의 특정 위치에 삽입
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

  const orderedProjects = useMemo(() => {
    if (!columnOrder || columnOrder.length === 0) return projects;
    const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
    const ordered = columnOrder.filter(id => projMap[id]).map(id => projMap[id]);
    const rest = projects.filter(p => !columnOrder.includes(p.id));
    return [...ordered, ...rest];
  }, [projects, columnOrder]);

  return (
    <>
      {/* 검색 + 프로젝트 등록 */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 mb-4">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="직원명, 직급, 협력사명"
              value={boardQuery}
              onChange={(e) => setBoardQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={onNewProject}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1 font-medium flex-shrink-0"
          >
            <FolderPlus size={14} /> <span className="hidden sm:inline">프로젝트 </span>등록
          </button>
        </div>
        <div className="mt-2 text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5">
          <GripVertical size={12} className="flex-shrink-0" />
          <span className="hidden sm:inline">카드를 드래그하여 다른 컬럼으로 이동하거나, 같은 컬럼 내에서 순서를 변경할 수 있습니다.</span>
          <span className="sm:hidden">카드를 드래그하여 이동하거나 순서를 변경하세요.</span>
        </div>
      </div>

      {/* 칸반 보드 */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0" style={{ minHeight: "600px" }}>
        {orderedProjects.map((proj) => {
          const c = COLOR_MAP[proj.color] || COLOR_MAP.slate;
          const q = boardQuery.trim().toLowerCase();
          const isPool = proj.id === "pool";

          // 검색 필터링
          const matchesSearch = (e) => !q
            || e.name.toLowerCase().includes(q)
            || e.rank.toLowerCase().includes(q)
            || (e.partnerName || "").toLowerCase().includes(q)
            || (e.duty || "").toLowerCase().includes(q)
            || (e.role || "").toLowerCase().includes(q);

          let members = isPool
            ? employees.filter(e => (e.projectId === "pool" || e.projectId == null || empStatuses[e.id]?.label === "투입예정") && matchesSearch(e))
            : employees.filter(e => e.projectId === proj.id && empStatuses[e.id]?.label !== "투입예정" && matchesSearch(e));

          // 대기 컬럼 정렬
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
            // 프로젝트 컬럼: localStorage 순서 적용
            members = applyColumnOrder(members, proj.id);
          }

          // 이벤트 핸들러에서 참조할 수 있도록 ref 저장
          columnMembersRef.current[proj.id] = members;

          const isOver = dragOverProj === proj.id;
          const isColumnOver = dragOverColumn === proj.id
            && draggingColumnRef.current !== null
            && String(draggingColumnRef.current) !== String(proj.id);
          const draggedEmp = dragId !== null ? employees.find(x => x.id === dragId) : null;
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
              } flex flex-col transition-colors`}
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
                    <span
                      className={`font-bold text-sm ${c.text} truncate`}
                      title={proj.name}
                    >
                      {proj.name}
                    </span>
                    <span className={`px-1.5 py-0.5 text-xs font-semibold rounded bg-white/70 ${c.text} flex-shrink-0`}>{members.length}</span>
                  </div>
                  {!isPool && (
                    <div className="flex gap-0.5 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); onEditProject(proj); }} className={`p-1 rounded hover:bg-white/70 ${c.text}`} title="프로젝트 수정"><Edit2 size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteProject(proj.id); }} className="p-1 rounded hover:bg-white/70 text-slate-500 hover:text-red-600" title="프로젝트 삭제"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                {!isPool && (
                  <div className={`flex items-center gap-1 text-[11px] ${c.text} opacity-80 mt-0.5`}>
                    <Calendar size={10} className="flex-shrink-0" />
                    <span className="font-medium flex-shrink-0">기간</span>
                    <span className="opacity-40 flex-shrink-0">:</span>
                    <span className="flex-1 tabular-nums">{proj.startDate || "미정"} ~ {proj.endDate || "미정"}</span>
                  </div>
                )}
                {!isPool && (() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const startStr = proj.startDate;
                  if (!startStr) return null;
                  const start = new Date(startStr);
                  const diffMs = today - start;
                  const diffDays = Math.round(diffMs / 86400000);
                  const label = diffDays >= 0 ? `D+${diffDays}` : `D${diffDays}`;
                  return (
                    <div className={`flex items-center gap-1 text-[11px] mt-0.5`}>
                      <Clock size={10} className={`flex-shrink-0 ${c.text} opacity-60`} />
                      <span className={`font-medium flex-shrink-0 ${c.text} opacity-80`}>경과</span>
                      <span className={`opacity-40 flex-shrink-0 ${c.text}`}>:</span>
                      <span className={`px-1 rounded text-[10px] font-bold ${c.header} ${c.text}`}>{label}</span>
                    </div>
                  );
                })()}
                {!isPool && (() => {
                  const pmEmp = members.find(m => m.duty === "PM");
                  return (
                    <div className={`flex items-center gap-1 text-[11px] mt-0.5`}>
                      <Briefcase size={10} className={`flex-shrink-0 ${pmEmp ? `${c.text} opacity-60` : "text-red-600"}`} />
                      <span className={`font-medium flex-shrink-0 ${pmEmp ? `${c.text} opacity-80` : "text-red-600"}`}>PM</span>
                      <span className={`opacity-40 flex-shrink-0 ${pmEmp ? `${c.text}` : "text-red-600"}`}>:</span>
                      {pmEmp ? (
                        <span className={`${c.text} opacity-70`}>{pmEmp.name}{pmEmp.rank ? ` ${pmEmp.rank}` : ""}</span>
                      ) : (
                        <span className="text-red-600 font-semibold">PM 등록 필수</span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* 대기 컬럼 안내 + 통계 */}
              {isPool && (
                <div className={`px-3 py-1.5 text-[11px] border-b ${c.border} ${
                  isPartnerDropWarning ? "bg-red-100 text-red-700 font-semibold" : "bg-white/50 text-slate-600"
                }`}>
                  {isPartnerDropWarning ? (
                    "⚠ 협력사 직원은 대기로 이동 시 자동 삭제됩니다"
                  ) : (() => {
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
                    if (withDates.length === 0) return "대기 인력이 없습니다";
                    const durations = withDates.map(m => calcWaitingDuration(getPendingBase(m))?.days ?? 0);
                    const avg = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
                    const max = Math.max(...durations);
                    return (
                      <div className="flex items-center justify-between gap-2 tabular-nums">
                        <span className="text-slate-500">평균 <span className="font-bold text-slate-700">{avg}</span>일</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500">최장 <span className={`font-bold ${max >= 90 ? "text-red-600" : max >= 30 ? "text-orange-600" : "text-slate-700"}`}>{max}</span>일</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 대기 컬럼 정렬 컨트롤 */}
              {isPool && (
                <div className={`px-2 py-1.5 border-b ${c.border} bg-white/40 flex items-center gap-1`}>
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
              )}

              {/* 카드 목록 */}
              <div className="p-2 space-y-2 overflow-y-auto flex-1" style={{ maxHeight: "650px" }}>
                {members.length === 0 && (
                  <div className="text-center text-xs text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-md">
                    {isOver ? (isPartnerDropWarning ? "여기 놓으면 자동 삭제" : "여기에 놓기") : "배치된 인원 없음"}
                  </div>
                )}
                {members.map((emp) => {
                  const empStatus = empStatuses[emp.id] || { label: "대기", color: "bg-slate-100 text-slate-600 border-slate-300" };
                  const CARD_STATUS_ICONS = { "대기": Clock, "투입예정": CalendarClock, "투입중": CheckCircle2, "철수": LogOut };
                  const CardStatusIcon = CARD_STATUS_ICONS[empStatus.label] || null;
                  const isPurePool = emp.projectId === "pool";
                  const empProjName = projectById[emp.projectId]?.name;
                  const isDragging = dragId === emp.id;
                  const displayStart = !emp.startDate || emp.startDate === "1111-01-01" ? "-" : emp.startDate;
                  const displayEnd = !emp.endDate || emp.endDate === "9999-12-31" ? "-" : emp.endDate;
                  const waitingLabel = isPurePool ? formatWaitingLabel(emp.pooledAt) : "";
                  const waitingDur = isPurePool ? calcWaitingDuration(emp.pooledAt) : null;
                  const waitingColor = !waitingDur ? "bg-amber-50 text-amber-700 border-amber-200"
                    : waitingDur.days >= 90 ? "bg-red-50 text-red-700 border-red-200"
                    : waitingDur.days >= 30 ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-amber-50 text-amber-700 border-amber-200";

                  // 투입예정 대기일수 배지
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

                  const showIndicatorAbove = dragOverCard?.empId === emp.id && dragOverCard?.above;
                  const showIndicatorBelow = dragOverCard?.empId === emp.id && !dragOverCard?.above;

                  return (
                    <div key={emp.id}>
                      {/* 드래그 삽입 위치 표시 (위) */}
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
                        className={`bg-white rounded-md border border-slate-200 p-2.5 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all select-none ${isDragging ? "opacity-40 scale-95" : ""}`}
                        title="클릭하여 상세 보기"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <GripVertical
                              size={12}
                              className="text-slate-300 flex-shrink-0 cursor-grab active:cursor-grabbing"
                            />
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
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <AffiliationBadge affiliation={emp.affiliation} partnerName={emp.partnerName} />
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
                          <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 tabular-nums flex justify-between">
                            <span>{displayStart}</span>
                            <span className="text-slate-300">→</span>
                            <span>{displayEnd}</span>
                          </div>
                        )}
                      </div>
                      {/* 드래그 삽입 위치 표시 (아래) */}
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

    </>
  );
}
