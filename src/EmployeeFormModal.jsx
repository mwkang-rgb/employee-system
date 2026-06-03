import { X } from "lucide-react";
import {
  AFFILIATIONS, RANKS, ASSIGNMENT_TYPES, ASSIGNMENT_TYPE_STYLES, SAMPLE_PARTNERS,
} from "./constants.js";

// 폼 필드 라벨 + 입력창 묶음 (이 파일 내부 로컬 컴포넌트)
function Field({ label, children }) {
  return (
    <div className="w-full min-w-0 max-w-full" style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// props:
//   editingEmp    — 편집 중인 직원 객체 (id === null 이면 신규 등록)
//   setEditingEmp — 필드 변경 시 상태 업데이트 함수
//   onClose       — 닫기 / 취소 버튼 클릭 시 호출
//   onSave        — 등록/저장 버튼 클릭 시 호출 (유효성 검사 포함)
//   projects      — 프로젝트 목록 (드롭다운용)
//   partnerList   — 등록된 협력사 목록 (자동완성용)
export default function EmployeeFormModal({
  editingEmp, setEditingEmp, onClose, onSave, projects, partnerList,
}) {
  if (!editingEmp) return null;

  const isNew = editingEmp.id === null;
  const isPool = editingEmp.projectId === "pool";
  const indetermStart = editingEmp.startDate === "1111-01-01";
  const indetermEnd = editingEmp.endDate === "9999-12-31";

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
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            {isNew ? "직원 등록" : "직원 정보 수정"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* 입력 폼 */}
        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto overflow-x-hidden flex-1">
          <Field label="직원명 *">
            <input
              type="text"
              value={editingEmp.name}
              onChange={(e) => setEditingEmp({ ...editingEmp, name: e.target.value })}
              className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="홍길동"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="소속 *">
              <select
                value={editingEmp.affiliation}
                onChange={(e) => setEditingEmp({ ...editingEmp, affiliation: e.target.value })}
                className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="직급 *">
              <select
                value={editingEmp.rank}
                onChange={(e) => setEditingEmp({ ...editingEmp, rank: e.target.value })}
                className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          {/* 협력사 선택 시에만 노출 */}
          {editingEmp.affiliation === "협력사" && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <Field label="협력사명 *">
                <input
                  type="text"
                  value={editingEmp.partnerName}
                  onChange={(e) => setEditingEmp({ ...editingEmp, partnerName: e.target.value })}
                  list="partner-list"
                  className="w-full px-3 py-2 text-base sm:text-sm border border-amber-300 rounded-md bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="예: LG CNS"
                />
                <datalist id="partner-list">
                  {partnerList.map(p => <option key={p} value={p} />)}
                  {SAMPLE_PARTNERS.map(p => <option key={`s-${p}`} value={p} />)}
                </datalist>
              </Field>
            </div>
          )}

          {/* 직무 · 역할 */}
          <Field label="직무">
            <input
              type="text"
              value={editingEmp.duty || ""}
              onChange={(e) => setEditingEmp({ ...editingEmp, duty: e.target.value })}
              autoComplete="off"
              className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="예: 개발, PM, 분석/설계"
            />
          </Field>
          <Field label="역할">
            <input
              type="text"
              value={editingEmp.role || ""}
              onChange={(e) => setEditingEmp({ ...editingEmp, role: e.target.value })}
              autoComplete="off"
              className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="예: 백엔드 개발, 파트 리더"
            />
          </Field>

          <Field label="투입 형태 *">
            <select
              value={editingEmp.assignmentType || "비계약"}
              onChange={(e) => setEditingEmp({ ...editingEmp, assignmentType: e.target.value })}
              className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ASSIGNMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {editingEmp.assignmentType && ASSIGNMENT_TYPE_STYLES[editingEmp.assignmentType] && (
              <div className="mt-1 text-[11px] text-slate-500">
                {ASSIGNMENT_TYPE_STYLES[editingEmp.assignmentType].desc}
              </div>
            )}
          </Field>

          <Field label="투입 프로젝트 *">
            <select
              value={editingEmp.projectId}
              onChange={(e) => setEditingEmp({ ...editingEmp, projectId: e.target.value })}
              className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {editingEmp.affiliation === "협력사" && editingEmp.projectId === "pool" && (
              <div className="mt-1.5 text-[11px] text-red-600 font-medium flex items-center gap-1">
                ⚠ 협력사 직원을 '대기'로 지정하면 저장 시 자동 삭제됩니다.
              </div>
            )}
          </Field>

          <Field label={isPool ? "투입일자" : "투입일자 *"}>
            <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}>
              <input
                type="date"
                value={indetermStart ? "" : (editingEmp.startDate || "")}
                onChange={(e) => setEditingEmp({ ...editingEmp, startDate: e.target.value })}
                disabled={isPool || indetermStart}
                className={`block px-3 py-2 text-base sm:text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPool || indetermStart ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" : "border-slate-300"}`}
                style={{
                  width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box",
                  minHeight: "42px", WebkitAppearance: "textfield", MozAppearance: "textfield",
                }}
              />
            </div>
            {!isPool && (
              <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={indetermStart}
                  onChange={(e) => setEditingEmp({ ...editingEmp, startDate: e.target.checked ? "1111-01-01" : "" })}
                  className="w-3.5 h-3.5 rounded accent-indigo-600"
                />
                날짜 미정
              </label>
            )}
          </Field>

          <Field label={isPool ? "철수일자" : "철수일자 *"}>
            <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}>
              <input
                type="date"
                value={indetermEnd ? "" : (editingEmp.endDate || "")}
                onChange={(e) => setEditingEmp({ ...editingEmp, endDate: e.target.value })}
                disabled={isPool || indetermEnd}
                className={`block px-3 py-2 text-base sm:text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPool || indetermEnd ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" : "border-slate-300"}`}
                style={{
                  width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box",
                  minHeight: "42px", WebkitAppearance: "textfield", MozAppearance: "textfield",
                }}
              />
            </div>
            {!isPool && (
              <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={indetermEnd}
                  onChange={(e) => setEditingEmp({ ...editingEmp, endDate: e.target.checked ? "9999-12-31" : "" })}
                  className="w-3.5 h-3.5 rounded accent-indigo-600"
                />
                날짜 미정
              </label>
            )}
          </Field>
        </div>

        {/* 하단 버튼 */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-700"
          >
            취소
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
          >
            {isNew ? "등록" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
