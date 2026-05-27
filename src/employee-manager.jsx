import React, { useState, useMemo, useEffect } from "react";
import { X, Users, Briefcase, Calendar, FolderKanban, LayoutList, Building2 } from "lucide-react";
import {
  INITIAL_PROJECTS, COLOR_MAP, COLOR_OPTIONS,
} from "./constants.js";
import {
  todayISO, getStatus, archiveCurrentAssignment, generateSampleData,
} from "./helpers.js";
import EmployeeDetailModal from "./EmployeeDetailModal.jsx";
import EmployeeFormModal from "./EmployeeFormModal.jsx";
import ProjectBoardView from "./ProjectBoardView.jsx";
import EmployeeListView from "./EmployeeListView.jsx";

export default function EmployeeManager() {
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [employees, setEmployees] = useState([]);
  const [view, setView] = useState("list");

  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);

  const [showProjModal, setShowProjModal] = useState(false);
  const [editingProj, setEditingProj] = useState(null);
  // 카드 상세 보기 팝업 (대기 카드 클릭 시)
  const [detailEmp, setDetailEmp] = useState(null);

  useEffect(() => {
    setEmployees(generateSampleData(INITIAL_PROJECTS));
  }, []);

  // 데이터 무결성 가드: 협력사 직원이 pool에 존재하면 자동 제거
  useEffect(() => {
    const hasInvalid = employees.some(e => e.affiliation === "협력사" && e.projectId === "pool");
    if (hasInvalid) {
      setEmployees(prev => prev.filter(e => !(e.affiliation === "협력사" && e.projectId === "pool")));
    }
  }, [employees]);

  const projectById = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);

  // 실제 등록된 협력사 목록 (필터용 + 등록 자동완성용)
  const partnerList = useMemo(() => {
    const set = new Set(
      employees
        .filter(e => e.affiliation === "협력사" && e.partnerName?.trim())
        .map(e => e.partnerName.trim())
    );
    return Array.from(set).sort();
  }, [employees]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => getStatus(e.startDate, e.endDate, e.projectId).label === "투입중").length;
    const waiting = employees.filter((e) => e.projectId === "pool").length;
    const ibks = employees.filter(e => e.affiliation === "IBKS").length;
    const partner = employees.filter(e => e.affiliation === "협력사").length;
    const projectCount = projects.filter(p => p.id !== "pool").length;
    return { total, active, waiting, ibks, partner, projectCount };
  }, [employees, projects]);

  const openNewEmp = () => {
    setEditingEmp({ id: null, name: "", rank: "사원", projectId: projects[0].id, startDate: "", endDate: "", affiliation: "IBKS", partnerName: "", duty: "", role: "", assignmentType: "비계약" });
    setShowEmpModal(true);
  };
  const openEditEmp = (emp) => { setEditingEmp({ ...emp }); setShowEmpModal(true); };
  const removeEmp = (id) => { if (confirm("이 직원 정보를 삭제하시겠습니까?")) setEmployees((prev) => prev.filter((e) => e.id !== id)); };
  const saveEmp = () => {
    if (!editingEmp.name.trim() || !editingEmp.startDate || !editingEmp.endDate) {
      alert("직원명, 투입일자, 철수일자는 필수 입력입니다."); return;
    }
    if (editingEmp.affiliation === "협력사" && !editingEmp.partnerName.trim()) {
      alert("협력사를 선택한 경우 협력사명을 입력해야 합니다."); return;
    }
    if (editingEmp.startDate > editingEmp.endDate) {
      alert("철수일자는 투입일자보다 빠를 수 없습니다."); return;
    }

    // 협력사 + 대기 조합은 자동 삭제 처리
    if (editingEmp.affiliation === "협력사" && editingEmp.projectId === "pool") {
      if (editingEmp.id === null) {
        alert("협력사 직원은 '대기'로 등록할 수 없습니다. 투입 프로젝트를 선택해 주세요.");
        return;
      }
      const ok = confirm(`협력사 직원은 '대기'로 이동 시 자동 삭제됩니다.\n\n${editingEmp.name} (${editingEmp.partnerName})\n\n계속하시겠습니까?`);
      if (!ok) return;
      setEmployees(prev => prev.filter(e => e.id !== editingEmp.id));
      setShowEmpModal(false);
      setEditingEmp(null);
      return;
    }

    const isMovingToPool = editingEmp.projectId === "pool";
    const prevEmp = editingEmp.id !== null ? employees.find(e => e.id === editingEmp.id) : null;
    const wasInPool = prevEmp?.projectId === "pool";
    const projectChanged = prevEmp && prevEmp.projectId !== editingEmp.projectId;
    const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
    let nextHistory = editingEmp.assignmentHistory || [];
    if (projectChanged && prevEmp.projectId && prevEmp.projectId !== "pool") {
      nextHistory = archiveCurrentAssignment(prevEmp, projMap, { closeEndDate: true });
    }

    const toSave = {
      ...editingEmp,
      partnerName: editingEmp.affiliation === "IBKS" ? "" : editingEmp.partnerName.trim(),
      duty: (editingEmp.duty || "").trim(),
      role: (editingEmp.role || "").trim(),
      pooledAt: isMovingToPool
        ? (wasInPool ? editingEmp.pooledAt || todayISO() : todayISO())
        : null,
      assignmentHistory: nextHistory,
    };
    if (editingEmp.id === null) {
      const newId = Math.max(0, ...employees.map((e) => e.id)) + 1;
      setEmployees((prev) => [...prev, { ...toSave, id: newId, assignmentHistory: [] }]);
    } else {
      setEmployees((prev) => prev.map((e) => (e.id === editingEmp.id ? toSave : e)));
    }
    setShowEmpModal(false);
    setEditingEmp(null);
  };

  const openNewProj = () => {
    setEditingProj({ id: null, name: "", color: COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)] });
    setShowProjModal(true);
  };
  const openEditProj = (proj) => { setEditingProj({ ...proj }); setShowProjModal(true); };
  const removeProj = (id) => {
    if (id === "pool") { alert("대기 컬럼은 삭제할 수 없습니다."); return; }
    const members = employees.filter(e => e.projectId === id);
    const ibksCount = members.filter(e => e.affiliation === "IBKS").length;
    const partnerCount = members.filter(e => e.affiliation === "협력사").length;
    let msg = "이 프로젝트를 삭제하시겠습니까?";
    if (members.length > 0) {
      const parts = [];
      if (ibksCount > 0) parts.push(`IBKS ${ibksCount}명은 '대기'로 이동`);
      if (partnerCount > 0) parts.push(`협력사 ${partnerCount}명은 자동 삭제`);
      msg = `이 프로젝트에 ${members.length}명이 배치되어 있습니다.\n삭제 시 ${parts.join(", ")}됩니다.\n\n계속하시겠습니까?`;
    }
    if (!confirm(msg)) return;
    const todayStr = todayISO();
    setEmployees(prev => {
      const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
      return prev
        .filter(e => !(e.projectId === id && e.affiliation === "협력사"))
        .map(e => {
          if (e.projectId !== id) return e;
          const newHistory = archiveCurrentAssignment(e, projMap, { closeEndDate: true });
          return { ...e, projectId: "pool", pooledAt: todayStr, assignmentHistory: newHistory };
        });
    });
    setProjects(prev => prev.filter(p => p.id !== id));
  };
  const saveProj = () => {
    if (!editingProj.name.trim()) { alert("프로젝트명을 입력하세요."); return; }
    if (editingProj.id === null) {
      const newId = `p_${Date.now()}`;
      setProjects(prev => {
        const pool = prev.find(p => p.id === "pool");
        const others = prev.filter(p => p.id !== "pool");
        return [pool, ...others, { ...editingProj, id: newId }].filter(Boolean);
      });
    } else {
      setProjects(prev => prev.map(p => p.id === editingProj.id ? editingProj : p));
    }
    setShowProjModal(false);
    setEditingProj(null);
  };

  // 드래그앤드롭으로 직원을 다른 프로젝트로 이동 (ProjectBoardView에서 호출)
  const handleDropEmployee = (empId, projId) => {
    setEmployees(prev => {
      const emp = prev.find(x => x.id === empId);
      if (!emp) return prev;
      if (emp.projectId === projId) return prev;
      if (projId === "pool" && emp.affiliation === "협력사") {
        return prev.filter(x => x.id !== empId);
      }
      const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
      const newHistory = archiveCurrentAssignment(emp, projMap, { closeEndDate: true });
      return prev.map(x => {
        if (x.id !== empId) return x;
        if (projId === "pool") return { ...x, projectId: projId, pooledAt: todayISO(), assignmentHistory: newHistory };
        return { ...x, projectId: projId, pooledAt: null, assignmentHistory: newHistory };
      });
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-[1400px] mx-auto p-3 sm:p-6">
        <div className="mb-4 sm:mb-6 flex items-end justify-between border-b border-slate-200 pb-3 sm:pb-5 gap-2">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs font-semibold tracking-widest text-slate-500 uppercase mb-1">SI개발본부 · 인력운영</div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900">직원 투입현황 관리</h1>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 flex-shrink-0">기준일 {new Date().toISOString().slice(0, 10)}</div>
        </div>

        <div className="flex gap-1 mb-4 sm:mb-5 border-b border-slate-200 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabBtn active={view === "list"} onClick={() => setView("list")} icon={<LayoutList size={15} />}>직원 관리</TabBtn>
          <TabBtn active={view === "board"} onClick={() => setView("board")} icon={<FolderKanban size={15} />}>프로젝트 배치 보드</TabBtn>
        </div>

        {/* 통계 카드 */}
        <div className="mb-4 sm:mb-6 -mx-3 px-3 lg:mx-0 lg:px-0 overflow-x-auto lg:overflow-visible">
          <div className="flex lg:grid lg:grid-cols-5 gap-2 sm:gap-3 min-w-max lg:min-w-0">
            <StatCard icon={<Users size={18} />} label="전체 인원" value={stats.total} accent="slate" />
            <StatCard icon={<Users size={18} />} label="IBKS" value={stats.ibks} accent="indigo" />
            <StatCard icon={<Building2 size={18} />} label="협력사" value={stats.partner} accent="amber" />
            <StatCard icon={<Briefcase size={18} />} label="투입중" value={stats.active} accent="emerald" />
            <StatCard icon={<Calendar size={18} />} label="대기 인력" value={stats.waiting} accent="rose" />
          </div>
        </div>

        {view === "list" && (
          <EmployeeListView
            employees={employees}
            projects={projects}
            projectById={projectById}
            partnerList={partnerList}
            onNewEmp={openNewEmp}
            onEditEmp={openEditEmp}
            onDeleteEmp={removeEmp}
          />
        )}

        {view === "board" && (
          <ProjectBoardView
            employees={employees}
            projects={projects}
            onDropEmployee={handleDropEmployee}
            onCardClick={(emp) => setDetailEmp(emp)}
            onNewProject={openNewProj}
            onEditProject={openEditProj}
            onDeleteProject={removeProj}
          />
        )}
      </div>

      {/* 직원 등록/수정 모달 */}
      {showEmpModal && (
        <EmployeeFormModal
          editingEmp={editingEmp}
          setEditingEmp={setEditingEmp}
          onClose={() => setShowEmpModal(false)}
          onSave={saveEmp}
          projects={projects}
          partnerList={partnerList}
        />
      )}

      {/* 카드 상세 보기 팝업 */}
      <EmployeeDetailModal
        detailEmp={detailEmp}
        projectById={projectById}
        onClose={() => setDetailEmp(null)}
        onEdit={() => {
          const target = detailEmp;
          setDetailEmp(null);
          setEditingEmp({ ...target });
          setShowEmpModal(true);
        }}
      />

      {/* 프로젝트 등록/수정 모달 */}
      {showProjModal && editingProj && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-2 sm:p-4 z-50" onClick={() => setShowProjModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">{editingProj.id === null ? "프로젝트 등록" : "프로젝트 수정"}</h2>
              <button onClick={() => setShowProjModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              <Field label="프로젝트명 *">
                <input type="text" value={editingProj.name} onChange={(e) => setEditingProj({ ...editingProj, name: e.target.value })} className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="예: 차세대 여신시스템" />
              </Field>
              <Field label="컬럼 색상">
                <div className="grid grid-cols-6 gap-2">
                  {COLOR_OPTIONS.map(color => {
                    const c = COLOR_MAP[color];
                    const selected = editingProj.color === color;
                    return (
                      <button key={color} onClick={() => setEditingProj({ ...editingProj, color })} className={`h-10 sm:h-9 rounded-md border-2 transition-all flex items-center justify-center ${selected ? "border-slate-900 scale-105" : "border-transparent"} ${c.bg}`}>
                        <span className={`w-3 h-3 rounded-full ${c.dot}`}></span>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 flex-shrink-0">
              <button onClick={() => setShowProjModal(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-700">취소</button>
              <button onClick={saveProj} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">{editingProj.id === null ? "등록" : "저장"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-colors -mb-px ${
        active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}>
      {icon}{children}
    </button>
  );
}

function StatCard({ icon, label, value, accent }) {
  const colors = {
    slate: "text-slate-600 bg-slate-100",
    emerald: "text-emerald-700 bg-emerald-100",
    amber: "text-amber-700 bg-amber-100",
    indigo: "text-indigo-700 bg-indigo-100",
    rose: "text-rose-700 bg-rose-100",
  };
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 flex items-center gap-2 sm:gap-3 flex-shrink-0 w-[140px] lg:w-auto">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-md flex items-center justify-center flex-shrink-0 ${colors[accent]}`}>{icon}</div>
      <div className="min-w-0 whitespace-nowrap">
        <div className="text-[11px] sm:text-xs text-slate-500 font-medium">{label}</div>
        <div className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="w-full min-w-0 max-w-full" style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
