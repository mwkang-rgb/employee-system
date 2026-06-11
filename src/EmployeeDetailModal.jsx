import { X, Edit2, Briefcase, Building2, UserCheck, FileText, Clock, CalendarClock, CheckCircle2, LogOut, Plus } from "lucide-react";
import { ASSIGNMENT_TYPE_STYLES } from "./constants.js";
import { calcWaitingDuration, formatWaitingLabel, resolveStatus } from "./helpers.js";

// 소속 배지 (이 파일 내부에서만 사용하는 로컬 컴포넌트)
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

// 라벨 + 값 한 줄 표시 (이 파일 내부에서만 사용하는 로컬 컴포넌트)
function DetailRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-xs text-slate-500 font-medium flex-shrink-0">{label}</span>
      <div className="text-right min-w-0 truncate">{children}</div>
    </div>
  );
}

// props:
//   detailEmp   — 표시할 직원 객체
//   projectById — { [id]: project } 맵
//   onClose     — 닫기 버튼 / 배경 클릭 시 호출
//   onEdit      — "정보 수정" 버튼 클릭 시 호출
export default function EmployeeDetailModal({ detailEmp, assignmentHistory, projectById, onClose, onEdit, onAddAssignment }) {
  if (!detailEmp) return null;

  const projectName = projectById[detailEmp.projectId]?.name;
  const status = resolveStatus(detailEmp, projectName);
  const STATUS_ICON = { "대기": Clock, "투입예정": CalendarClock, "투입중": CheckCircle2, "철수": LogOut };
  const StatusIcon = STATUS_ICON[status.label] || null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-2 sm:p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: "28rem" }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <UserCheck size={18} className="text-slate-600" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">직원 상세</div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                {detailEmp.name} <span className="text-sm font-medium text-slate-500">{detailEmp.rank}</span>
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X size={22} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* 소속 / 직무 / 역할 / 투입형태 / 상태 배지 */}
          <div className="flex flex-wrap gap-1.5">
            <AffiliationBadge affiliation={detailEmp.affiliation} partnerName={detailEmp.partnerName} />
            {detailEmp.duty && detailEmp.duty !== "없음" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border bg-slate-50 text-slate-700 border-slate-200">
                <Briefcase size={10} />
                {detailEmp.duty}
              </span>
            )}
            {detailEmp.role && detailEmp.role !== "없음" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border bg-slate-50 text-slate-700 border-slate-200">
                <UserCheck size={10} />
                {detailEmp.role}
              </span>
            )}
            {detailEmp.assignmentType && detailEmp.assignmentType !== "대기" && detailEmp.assignmentType !== status.label && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border ${ASSIGNMENT_TYPE_STYLES[detailEmp.assignmentType]?.badge || "bg-slate-50 text-slate-700 border-slate-200"}`}>
                <FileText size={10} />
                {detailEmp.assignmentType}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border ${status.color}`}>
              {StatusIcon && <StatusIcon size={10} />}
              {status.label}
            </span>
          </div>

          {/* 현재 투입 정보 (대기 인력 제외) */}
          {detailEmp.projectId !== "pool" && detailEmp.assignmentType !== "대기" && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase size={13} /> 현재 투입 정보
              </div>
              <div className="p-3 space-y-2.5">
                <DetailRow label="투입 프로젝트">
                  <span className="font-semibold text-slate-900">{projectById[detailEmp.projectId]?.name || "-"}</span>
                </DetailRow>
                <DetailRow label="투입일자">
                  <span className="tabular-nums text-slate-700">
                    {!detailEmp.startDate || detailEmp.startDate === "1111-01-01" ? "-" : detailEmp.startDate}
                  </span>
                </DetailRow>
                <DetailRow label="철수일자">
                  <span className="tabular-nums text-slate-700">
                    {!detailEmp.endDate || detailEmp.endDate === "9999-12-31" ? "-" : detailEmp.endDate}
                  </span>
                </DetailRow>
                <DetailRow label="투입 형태">
                  {detailEmp.assignmentType ? (
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border ${ASSIGNMENT_TYPE_STYLES[detailEmp.assignmentType]?.badge}`}>
                      {detailEmp.assignmentType}
                    </span>
                  ) : <span className="text-slate-400">미지정</span>}
                </DetailRow>
              </div>
            </div>
          )}

          {/* 대기 상태 카드 (대기 인력만) */}
          {(detailEmp.projectId === "pool" || detailEmp.assignmentType === "대기") && detailEmp.pooledAt && (() => {
            const dur = calcWaitingDuration(detailEmp.pooledAt);
            const colorCls = dur.days >= 90 ? "text-red-700 bg-red-50 border-red-200"
              : dur.days >= 30 ? "text-orange-700 bg-orange-50 border-orange-200"
              : "text-amber-700 bg-amber-50 border-amber-200";
            return (
              <div className={`rounded-lg border p-3 ${colorCls}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider mb-0.5">현재 대기 상태</div>
                    <div className="text-[13px]">대기 시작 <span className="font-semibold tabular-nums">{detailEmp.pooledAt}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums leading-none">{formatWaitingLabel(detailEmp.pooledAt)}</div>
                    <div className="text-[10px] mt-1 font-medium opacity-80">경과</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 투입 이력 타임라인 */}
          {(() => {
            const history = (assignmentHistory || []).slice().reverse(); // 최신이 위
            if (history.length === 0) {
              return (
                <div className="rounded-lg border border-slate-200 p-3 text-center">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">투입 이력</div>
                  <div className="text-xs text-slate-400">누적된 투입 이력이 없습니다</div>
                </div>
              );
            }
            const totalMonths = history.reduce((sum, h) => {
              if (!h.startDate || !h.endDate) return sum;
              const s = new Date(h.startDate), e = new Date(h.endDate);
              return sum + Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
            }, 0);
            return (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">투입 이력 ({history.length}건)</div>
                  <div className="text-[11px] font-semibold text-slate-500 tabular-nums">누적 {totalMonths}개월</div>
                </div>
                <div className="p-3 max-h-[260px] overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
                  <ol className="space-y-4">
                    {history.map((h, idx) => {
                      const typeStyle = ASSIGNMENT_TYPE_STYLES[h.assignmentType];
                      const dotColor = typeStyle?.dot || "bg-slate-400";
                      const isLast = idx === history.length - 1;
                      return (
                        <li key={h.id || idx} className="relative pl-7 min-w-0">
                          {!isLast && (
                            <span className="absolute left-[5px] top-[18px] bottom-[-16px] w-px bg-slate-200" aria-hidden />
                          )}
                          <span
                            className={`absolute left-0 top-[6px] w-3 h-3 rounded-full ${dotColor} ring-2 ring-white shadow-[0_0_0_1px_rgba(0,0,0,0.04)]`}
                            aria-hidden
                          />
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <div className="font-semibold text-sm text-slate-900 truncate min-w-0 flex-1" title={h.projectName}>
                              {h.projectName}
                            </div>
                            {h.assignmentType && typeStyle && (
                              <span className={`text-[10px] px-1.5 py-0.5 font-semibold rounded border flex-shrink-0 ${typeStyle.badge}`}>
                                {h.assignmentType}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 tabular-nums truncate">
                            {(!h.startDate || h.startDate === "1111-01-01") ? "-" : h.startDate}
                            {" → "}
                            {(!h.endDate || h.endDate === "9999-12-31") ? "-" : h.endDate}
                          </div>
                          {(h.role || h.duty) && (
                            <div className="text-[11px] text-slate-600 mt-0.5 truncate" title={[h.duty, h.role].filter(Boolean).join(" · ")}>
                              {h.duty && <span className="font-medium">{h.duty}</span>}
                              {h.duty && h.role && <span className="text-slate-300"> · </span>}
                              {h.role}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            );
          })()}

        </div>

        {/* 하단 버튼 */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 flex-shrink-0">
          {detailEmp?.residencyType === "비상주" && status.label !== "대기" && (
            <button
              onClick={() => onAddAssignment?.(detailEmp)}
              className="px-4 py-2 text-sm border border-violet-300 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 flex items-center gap-1"
            >
              <Plus size={13} /> 추가 투입
            </button>
          )}
          <button
            onClick={onEdit}
            className="px-4 py-2 text-sm border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-700 flex items-center gap-1"
          >
            <Edit2 size={13} /> 정보 수정
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
