import { useState } from "react";
import { Search, Edit2, Trash2, GripVertical, FolderPlus, Building2 } from "lucide-react";
import { COLOR_MAP, POOL_SORT_OPTIONS, RANK_ORDER } from "./constants.js";
import { resolveStatus, calcWaitingDuration, formatWaitingLabel } from "./helpers.js";

// 소속 배지 (이 파일 내부 로컬 컴포넌트)
function AffiliationBadge({ affiliation, partnerName }) {
  if (affiliation === "IBKS") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
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
  onDropEmployee, onCardClick,
  onNewProject, onEditProject, onDeleteProject,
}) {
  const [boardQuery, setBoardQuery] = useState("");
  const [dragId, setDragId] = useState(null);
  const [dragOverProj, setDragOverProj] = useState(null);
  const [poolSortField, setPoolSortField] = useState("waitingDays");
  const [poolSortDir, setPoolSortDir] = useState("desc");

  // ── 드래그 핸들러 ──────────────────────────────────────────
  const handleDragStart = (e, empId) => {
    setDragId(empId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(empId));
  };
  const handleDragEnd = () => { setDragId(null); setDragOverProj(null); };
  const handleDragOver = (e, projId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverProj !== projId) setDragOverProj(projId);
  };
  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverProj(null);
  };
  const handleDrop = (e, projId) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/plain"));
    setDragId(null);
    setDragOverProj(null);
    if (!Number.isNaN(id)) onDropEmployee(id, projId);
  };

  const projectById = Object.fromEntries(projects.map(p => [p.id, p]));
  const empStatuses = Object.fromEntries(
    employees.map(e => [e.id, resolveStatus(e, projectById[e.projectId]?.name)])
  );

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
          <span className="hidden sm:inline">직원 카드를 다른 프로젝트 컬럼으로 드래그하여 배치를 변경할 수 있습니다.</span>
          <span className="sm:hidden">카드를 길게 눌러 다른 컬럼으로 드래그하세요.</span>
        </div>
      </div>

      {/* 칸반 보드 */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0" style={{ minHeight: "600px" }}>
        {projects.map((proj) => {
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
            ? employees.filter(e => (e.projectId === "pool" || empStatuses[e.id]?.label === "투입예정") && matchesSearch(e))
            : employees.filter(e => e.projectId === proj.id && empStatuses[e.id]?.label !== "투입예정" && matchesSearch(e));

          // 대기 컬럼 정렬
          if (isPool) {
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

          const isOver = dragOverProj === proj.id;
          const draggedEmp = dragId !== null ? employees.find(x => x.id === dragId) : null;
          const isPartnerDropWarning = isPool && isOver && draggedEmp?.affiliation === "협력사";

          return (
            <div
              key={proj.id}
              onDragOver={(e) => handleDragOver(e, proj.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, proj.id)}
              className={`flex-shrink-0 w-64 sm:w-72 rounded-lg border-2 ${
                isPartnerDropWarning ? "border-red-400 bg-red-50/40" :
                isOver ? "border-indigo-400 bg-indigo-50/30" :
                `${c.border} ${c.bg}`
              } flex flex-col transition-colors`}
            >
              {/* 컬럼 헤더 */}
              <div className={`px-3 py-2.5 border-b ${c.border} ${c.header} rounded-t-md flex items-center justify-between`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${c.dot} flex-shrink-0`}></span>
                  <span className={`font-bold text-sm ${c.text} truncate`}>{proj.name}</span>
                  <span className={`px-1.5 py-0.5 text-xs font-semibold rounded bg-white/70 ${c.text} flex-shrink-0`}>{members.length}</span>
                </div>
                {!isPool && (
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button onClick={() => onEditProject(proj)} className={`p-1 rounded hover:bg-white/70 ${c.text}`} title="프로젝트 수정"><Edit2 size={12} /></button>
                    <button onClick={() => onDeleteProject(proj.id)} className="p-1 rounded hover:bg-white/70 text-slate-500 hover:text-red-600" title="프로젝트 삭제"><Trash2 size={12} /></button>
                  </div>
                )}
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
                  <button
                    onClick={() => setPoolSortDir(poolSortDir === "asc" ? "desc" : "asc")}
                    className="px-2 py-1 text-[11px] border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-700 flex-shrink-0 font-semibold"
                    title={poolSortDir === "asc" ? "오름차순" : "내림차순"}
                  >
                    {poolSortDir === "asc" ? "↑" : "↓"}
                  </button>
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

                  return (
                    <div
                      key={emp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, emp.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onCardClick(emp)}
                      className={`bg-white rounded-md border border-slate-200 p-2.5 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all ${isDragging ? "opacity-40 scale-95" : ""}`}
                      title="클릭하여 상세 보기"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GripVertical size={12} className="text-slate-300 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-900 truncate">{emp.name}</div>
                            <div className="text-xs text-slate-500">{emp.rank}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 font-medium rounded border ${empStatus.color}`}>
                            {empStatus.label}
                          </span>
                          {isPool && waitingLabel && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 font-semibold rounded border ${waitingColor} tabular-nums`}
                              title={emp.pooledAt ? `대기 시작: ${emp.pooledAt}` : ""}
                            >
                              {waitingLabel}
                            </span>
                          )}
                          {isTipRuYeJeong && pendingLabel && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 font-semibold rounded border ${pendingColor} tabular-nums`}
                              title={pendingBaseDate ? `기산일: ${pendingBaseDate}` : ""}
                            >
                              {pendingLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <AffiliationBadge affiliation={emp.affiliation} partnerName={emp.partnerName} />
                        {emp.duty && emp.duty !== "없음" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border bg-slate-50 text-slate-600 border-slate-200">
                            {emp.duty}
                          </span>
                        )}
                        {emp.role && emp.role !== "없음" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border bg-slate-50 text-slate-600 border-slate-200">
                            {emp.role}
                          </span>
                        )}
                      </div>
                      {isPurePool && emp.pooledAt ? (
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
