import React, { useState, useMemo, useEffect, useRef } from "react";
import { X, Users, Briefcase, Calendar, FolderKanban, LayoutList, Building2, LogOut, Trash2 } from "lucide-react";
import { useRealtimeSync } from "./useRealtimeSync.js";
import { useAuth } from "./AuthContext.jsx";
import { COLOR_MAP, COLOR_OPTIONS } from "./constants.js";
import { todayISO, getStatus, resolveStatus, archiveCurrentAssignment } from "./helpers.js";
import { supabase } from "./supabaseClient";
import * as XLSX from "xlsx";
import EmployeeDetailModal from "./EmployeeDetailModal.jsx";
import EmployeeFormModal from "./EmployeeFormModal.jsx";
import ProjectBoardView from "./ProjectBoardView.jsx";
import EmployeeListView from "./EmployeeListView.jsx";
import AlertModal from "./AlertModal.jsx";

function dbToApp(row) {
  if (!row) return row;
  return {
    ...row,
    projectId: row.project_id == null ? "pool" : row.project_id,
    startDate: row.start_date ?? row.startDate,
    endDate: row.end_date ?? row.endDate,
    partnerName: row.partner_name ?? row.partnerName,
    pooledAt: row.pooled_at ?? row.pooledAt,
    assignmentHistory: row.assignment_history ?? row.assignmentHistory ?? [],
    assignmentType: row.assignment_type ?? row.assignmentType,
  };
}

function appToDb(obj) {
  const result = { ...obj };
  if ('projectId' in result) { result.project_id = result.projectId === "pool" ? null : result.projectId; delete result.projectId; }
  if ('startDate' in result) { result.start_date = result.startDate; delete result.startDate; }
  if ('endDate' in result) { result.end_date = result.endDate; delete result.endDate; }
  if ('partnerName' in result) { result.partner_name = result.partnerName; delete result.partnerName; }
  if ('pooledAt' in result) { result.pooled_at = result.pooledAt; delete result.pooledAt; }
  if ('assignmentHistory' in result) { result.assignment_history = result.assignmentHistory; delete result.assignmentHistory; }
  if ('assignmentType' in result) { result.assignment_type = result.assignmentType; delete result.assignmentType; }
  return result;
}

export default function EmployeeManager() {
  const [projects, setProjects] = useState([{ id: "pool", name: "대기", color: "slate" }]);
  const [employees, setEmployees] = useState([]);

  const { session, user, signOut } = useAuth();
  useRealtimeSync({ setEmployees, setProjects, enabled: !!session });

  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(false);

  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);

  const [showProjModal, setShowProjModal] = useState(false);
  const [editingProj, setEditingProj] = useState(null);
  const [isProjSubmitting, setIsProjSubmitting] = useState(false);
  const isProjSubmittingRef = useRef(false);
  // 카드 상세 보기 팝업 (대기 카드 클릭 시)
  const [detailEmp, setDetailEmp] = useState(null);

  // 커스텀 알림 모달
  const [alertInfo, setAlertInfo] = useState(null);
  const showAlert = (title, message) => setAlertInfo({ title, message });

  // 프로젝트 삭제 확인 모달
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // deleteConfirm = { projId, members, ibksCount, partnerCount }

  // 직원 조회
  useEffect(() => {
    if (!supabase) {
      console.error("Supabase 미연결 — 환경변수를 확인하세요");
      setLoading(false);
      return;
    }
    const fetchEmployees = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("employees").select("*");
      if (error) console.error("직원 조회 오류:", error);
      else setEmployees((data || []).map(dbToApp));
      setLoading(false);
    };
    fetchEmployees();
  }, []);

  // 프로젝트 조회
  useEffect(() => {
    if (!supabase) return;
    const fetchProjects = async () => {
      const { data, error } = await supabase.from("projects").select("*");
      if (error) { console.error("프로젝트 조회 오류:", error); return; }
      const POOL = { id: "pool", name: "대기", color: "slate" };
      setProjects([POOL, ...(data || []).filter(p => p.id !== "pool")]);
    };
    fetchProjects();
  }, []);

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
    const active = employees.filter((e) => resolveStatus(e, projectById[e.projectId]?.name).label === "투입중").length;
    const waiting = employees.filter((e) => e.projectId === "pool").length;
    const ibks = employees.filter(e => e.affiliation === "IBKS").length;
    const partner = employees.filter(e => e.affiliation === "협력사").length;
    const projectCount = projects.filter(p => p.id !== "pool").length;
    return { total, active, waiting, ibks, partner, projectCount };
  }, [employees, projects]);

  const openNewEmp = () => {
    setEditingEmp({ id: null, name: "", rank: "사원", projectId: "pool", startDate: "", endDate: "", affiliation: "IBKS", partnerName: "", duty: "", role: "", assignmentType: "대기" });
    setShowEmpModal(true);
  };
  const openEditEmp = (emp) => {
    const normalized = emp.projectId === "pool" && emp.assignmentType !== "대기"
      ? { ...emp, assignmentType: "대기" }
      : { ...emp };
    setEditingEmp(normalized);
    setShowEmpModal(true);
  };
  const removeEmp = async (id) => {
    if (!confirm("이 직원 정보를 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) { console.error(error); showAlert("알림", "삭제 실패"); return; }
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };
  const saveEmp = async () => {
    const isPool = editingEmp.projectId === "pool" || editingEmp.assignmentType === "대기";
    const isPending = editingEmp.assignmentType === "투입예정";
    const dateOptional = isPool || isPending;
    const indetermStart = editingEmp.startDate === "1111-01-01";
    const indetermEnd = editingEmp.endDate === "9999-12-31";
    if (!editingEmp.name.trim()) {
      showAlert("알림", "직원명은 필수 입력입니다."); return;
    }
    if (editingEmp.affiliation === "협력사" && !editingEmp.partnerName.trim()) {
      showAlert("알림", "협력사를 선택한 경우 협력사명을 입력해야 합니다."); return;
    }
    if (editingEmp.projectId !== "pool" && editingEmp.assignmentType === "대기") {
      showAlert("투입 형태 오류", "올바른 투입 형태를 선택한 후 저장해 주세요."); return;
    }
    if (editingEmp.projectId !== "pool") {
      const duty = (editingEmp.duty || "").trim();
      const role = (editingEmp.role || "").trim();
      if (!duty || duty === "없음" || !role || role === "없음") {
        showAlert("필수 항목 누락", "직무와 역할을 입력한 후 저장해 주세요."); return;
      }
    }
    if (!dateOptional) {
      const startMissing = !editingEmp.startDate && !indetermStart;
      const endMissing = !editingEmp.endDate && !indetermEnd;
      if (startMissing || endMissing) {
        showAlert("날짜 입력 오류", "올바른 투입 기간을 입력한 후 저장해 주세요."); return;
      }
    }
    if (!dateOptional && !indetermStart && !indetermEnd && editingEmp.startDate && editingEmp.endDate && editingEmp.startDate > editingEmp.endDate) {
      showAlert("날짜 입력 오류", "철수일자는 투입일자보다 빠를 수 없습니다."); return;
    }

    // 협력사 + 대기 조합은 자동 삭제 처리
    if (editingEmp.affiliation === "협력사" && isPool) {
      if (editingEmp.id === null) {
        showAlert("알림", "협력사 직원은 '대기'로 등록할 수 없습니다. 투입 프로젝트를 선택해 주세요.");
        return;
      }
      const ok = confirm(`협력사 직원은 '대기'로 이동 시 자동 삭제됩니다.\n\n${editingEmp.name} (${editingEmp.partnerName})\n\n계속하시겠습니까?`);
      if (!ok) return;
      const { error: delErr } = await supabase.from("employees").delete().eq("id", editingEmp.id);
      if (delErr) { console.error(delErr); showAlert("알림", "삭제 실패"); return; }
      setEmployees(prev => prev.filter(e => e.id !== editingEmp.id));
      setShowEmpModal(false);
      setEditingEmp(null);
      return;
    }

    const prevEmp = editingEmp.id !== null ? employees.find(e => e.id === editingEmp.id) : null;
    const wasInPool = prevEmp?.projectId === "pool" || prevEmp?.assignmentType === "대기";
    const projectChanged = prevEmp && prevEmp.projectId !== editingEmp.projectId;
    const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
    let nextHistory = editingEmp.assignmentHistory || [];
    if (projectChanged && prevEmp.projectId && prevEmp.projectId !== "pool") {
      nextHistory = archiveCurrentAssignment(prevEmp, projMap, { closeEndDate: true });
    }

    const toSave = {
      ...editingEmp,
      partnerName: editingEmp.affiliation === "IBKS" ? "" : editingEmp.partnerName.trim(),
      duty: (editingEmp.duty || "").trim() || "없음",
      role: (editingEmp.role || "").trim() || "없음",
      pooledAt: isPool
        ? (wasInPool ? editingEmp.pooledAt || todayISO() : todayISO())
        : null,
      assignmentHistory: nextHistory,
      startDate: dateOptional ? null : editingEmp.startDate,
      endDate: dateOptional ? null : editingEmp.endDate,
    };
    const { id: _id, ...rawPayload } = toSave;
    const payload = appToDb(rawPayload);
    if (editingEmp.id === null) {
      const { data, error } = await supabase.from("employees").insert([payload]).select().single();
      if (error) { console.error(error); showAlert("알림", "저장 실패"); return; }
      setEmployees((prev) => [...prev, dbToApp(data)]);
    } else {
      const { data, error } = await supabase.from("employees").update(payload).eq("id", editingEmp.id).select().single();
      if (error) { console.error(error); showAlert("알림", "수정 실패"); return; }
      setEmployees((prev) => prev.map((e) => (e.id === editingEmp.id ? dbToApp(data) : e)));
    }
    setShowEmpModal(false);
    setEditingEmp(null);
  };

  const handleBulkUpload = async (file) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

    if (rows.length === 0) { showAlert("알림", "업로드할 데이터가 없습니다."); return; }

    const REQUIRED = ["이름", "소속", "직급", "투입형태", "투입프로젝트"];
    const errors = [];
    rows.forEach((row, i) => {
      const rowNum = i + 2;
      REQUIRED.forEach(col => {
        if (!row[col]?.toString().trim()) errors.push(`${rowNum}행: '${col}' 필수값 누락`);
      });
    });
    if (errors.length > 0) {
      showAlert("알림", "유효성 오류:\n\n" + errors.slice(0, 10).join("\n") + (errors.length > 10 ? `\n...외 ${errors.length - 10}건` : ""));
      return;
    }

    const projByName = Object.fromEntries(projects.map(p => [p.name, p.id]));
    const payloadErrors = [];
    const payloads = rows.map((row, i) => {
      const projName = row["투입프로젝트"].toString().trim();
      const isPool = projName === "대기";
      const projectId = isPool ? "pool" : projByName[projName];
      if (!isPool && !projectId) {
        payloadErrors.push(`${i + 2}행: 프로젝트 '${projName}'을 찾을 수 없습니다`);
        return null;
      }
      const 소속 = row["소속"].toString().trim();
      return {
        name: row["이름"].toString().trim(),
        affiliation: 소속 === "IBKS" ? "IBKS" : "협력사",
        partner_name: 소속 === "IBKS" ? "" : 소속,
        rank: row["직급"].toString().trim(),
        duty: (row["직무"] || "").toString().trim() || "없음",
        role: (row["역할"] || "").toString().trim() || "없음",
        assignment_type: row["투입형태"].toString().trim(),
        project_id: projectId,
        start_date: isPool ? null : (row["투입일자"]?.toString().trim() || "1111-01-01"),
        end_date: isPool ? null : (row["철수일자"]?.toString().trim() || "9999-12-31"),
        pooled_at: isPool ? todayISO() : null,
        assignment_history: [],
      };
    }).filter(Boolean);

    if (payloadErrors.length > 0) { showAlert("알림", "오류:\n\n" + payloadErrors.join("\n")); return; }

    const existingByName = Object.fromEntries(employees.map(e => [e.name, e.id]));
    const toInsert = payloads.filter(p => !existingByName[p.name]);
    const toUpdate = payloads
      .filter(p => existingByName[p.name])
      .map(p => ({ ...p, id: existingByName[p.name] }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from("employees").insert(toInsert);
      if (error) { showAlert("알림", "등록 실패: " + error.message); return; }
    }
    if (toUpdate.length > 0) {
      const { error } = await supabase.from("employees").upsert(toUpdate, { onConflict: "id" });
      if (error) { showAlert("알림", "수정 실패: " + error.message); return; }
    }

    const { data, error: fetchErr } = await supabase.from("employees").select("*");
    if (!fetchErr) setEmployees((data || []).map(dbToApp));

    showAlert("알림", `${payloads.length}건의 직원 정보가 업로드되었습니다.`);
  };

  const openNewProj = () => {
    setEditingProj({ id: null, name: "", color: COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)] });
    setShowProjModal(true);
  };
  const openEditProj = (proj) => { setEditingProj({ ...proj }); setShowProjModal(true); };
  const removeProj = (id) => {
    if (id === "pool") { showAlert("알림", "대기 컬럼은 삭제할 수 없습니다."); return; }
    const members = employees.filter(e => e.projectId === id);
    const ibksCount = members.filter(e => e.affiliation === "IBKS").length;
    const partnerCount = members.filter(e => e.affiliation === "협력사").length;
    setDeleteConfirm({ projId: id, members, ibksCount, partnerCount });
  };
  const doDeleteProject = async () => {
    const { projId, members, ibksCount, partnerCount } = deleteConfirm;
    setDeleteConfirm(null);
    const todayStr = todayISO();
    const projMap = Object.fromEntries(projects.map(p => [p.id, p]));

    // DB: 협력사 직원 삭제
    const { error: partnerErr } = await supabase.from("employees")
      .delete().eq("project_id", projId).eq("affiliation", "협력사");
    if (partnerErr) { console.error(partnerErr); showAlert("알림", "프로젝트 삭제 실패"); return; }

    // DB: IBKS 직원 대기로 이동 (assignment_history가 직원마다 달라 개별 업데이트)
    const ibksMembers = members.filter(e => e.affiliation === "IBKS");
    for (const emp of ibksMembers) {
      const newHistory = archiveCurrentAssignment(emp, projMap, { closeEndDate: true });
      const { error: empErr } = await supabase.from("employees")
        .update(appToDb({ projectId: "pool", pooledAt: todayStr, endDate: todayStr, assignmentType: "대기", assignmentHistory: newHistory }))
        .eq("id", emp.id);
      if (empErr) { console.error(empErr); showAlert("알림", "프로젝트 삭제 실패"); return; }
    }

    // DB: 프로젝트 삭제
    const { error } = await supabase.from("projects").delete().eq("id", projId);
    if (error) { console.error(error); showAlert("알림", "프로젝트 삭제 실패"); return; }

    // 로컬 state 동기화
    setEmployees(prev => prev
      .filter(e => !(e.projectId === projId && e.affiliation === "협력사"))
      .map(e => {
        if (e.projectId !== projId) return e;
        const newHistory = archiveCurrentAssignment(e, projMap, { closeEndDate: true });
        return { ...e, projectId: "pool", pooledAt: todayStr, endDate: todayStr, assignmentType: "대기", assignmentHistory: newHistory };
      })
    );
    setProjects(prev => prev.filter(p => p.id !== projId));
  };
  const saveProj = async () => {
    if (!editingProj.name.trim()) { showAlert("알림", "프로젝트명을 입력하세요."); return; }
    if (isProjSubmittingRef.current) return;
    isProjSubmittingRef.current = true;
    setIsProjSubmitting(true);
    try {
      if (editingProj.id === null) {
        const { data, error } = await supabase
          .from("projects")
          .insert([{ name: editingProj.name, color: editingProj.color }])
          .select()
          .single();
        if (error) { console.error(error); showAlert("알림", "프로젝트 저장 실패"); return; }
        setProjects(prev => {
          const pool = prev.find(p => p.id === "pool");
          const others = prev.filter(p => p.id !== "pool");
          return [pool, ...others, data].filter(Boolean);
        });
      } else {
        const { error } = await supabase
          .from("projects")
          .update({ name: editingProj.name, color: editingProj.color })
          .eq("id", editingProj.id);
        if (error) { console.error(error); showAlert("알림", "프로젝트 수정 실패"); return; }
        setProjects(prev => prev.map(p => p.id === editingProj.id ? editingProj : p));
      }
      setShowProjModal(false);
      setEditingProj(null);
    } finally {
      isProjSubmittingRef.current = false;
      setIsProjSubmitting(false);
    }
  };

  // 드래그앤드롭으로 직원을 다른 프로젝트로 이동 (ProjectBoardView에서 호출)
  const handleDropEmployee = async (empId, projId) => {
    const emp = employees.find(x => x.id === empId);
    if (!emp) return;
    if (emp.projectId === projId) return;

    if (projId === "pool" && emp.affiliation === "협력사") {
      const { error } = await supabase.from("employees").delete().eq("id", empId);
      if (error) { console.error(error); showAlert("알림", "삭제 실패"); return; }
      setEmployees(prev => prev.filter(x => x.id !== empId));
      return;
    }

    const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
    const newHistory = archiveCurrentAssignment(emp, projMap, { closeEndDate: true });
    const isPending = emp.assignmentType === "투입예정";
    const updatePayload = appToDb(projId === "pool"
      ? (isPending
          ? { projectId: projId, pooledAt: todayISO(), assignmentHistory: newHistory, startDate: null, endDate: todayISO() }
          : { projectId: projId, pooledAt: todayISO(), assignmentHistory: newHistory, startDate: null, endDate: todayISO(), assignmentType: "대기", duty: "", role: "" })
      : { projectId: projId, pooledAt: null, assignmentHistory: newHistory });

    const { error } = await supabase.from("employees").update(updatePayload).eq("id", empId);
    if (error) { console.error(error); showAlert("알림", "배치 변경 실패"); return; }

    setEmployees(prev => prev.map(x => {
      if (x.id !== empId) return x;
      if (projId === "pool") {
        const baseUpdate = { projectId: projId, pooledAt: todayISO(), assignmentHistory: newHistory, startDate: null, endDate: todayISO() };
        return (x.assignmentType === "투입예정")
          ? { ...x, ...baseUpdate }
          : { ...x, ...baseUpdate, assignmentType: "대기", duty: "", role: "" };
      }
      return { ...x, projectId: projId, pooledAt: null, assignmentHistory: newHistory };
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-[1400px] mx-auto p-3 sm:p-6">
        <div className="mb-4 sm:mb-6 flex items-end justify-between border-b border-slate-200 pb-3 sm:pb-5 gap-2">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs font-semibold tracking-widest text-slate-500 uppercase mb-1">SI개발본부 · 인력운영</div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900">직원 투입현황 관리</h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">기준일 {new Date().toISOString().slice(0, 10)}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 hidden sm:block">{user?.email}</span>
              <button
                onClick={signOut}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-600 flex items-center gap-1.5"
              >
                <LogOut size={12} />
                로그아웃
              </button>
            </div>
          </div>
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

        {loading && (
          <div className="text-center py-10 text-slate-400">데이터 불러오는 중...</div>
        )}

        {!loading && view === "list" && (
          <EmployeeListView
            employees={employees}
            projects={projects}
            projectById={projectById}
            partnerList={partnerList}
            onNewEmp={openNewEmp}
            onEditEmp={openEditEmp}
            onDeleteEmp={removeEmp}
            onBulkUpload={handleBulkUpload}
          />
        )}

        {!loading && view === "board" && (
          <ProjectBoardView
            employees={employees}
            projects={projects}
            onDropEmployee={handleDropEmployee}
            onCardClick={(emp) => setDetailEmp(emp)}
            onEditEmp={openEditEmp}
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

      {/* 프로젝트 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center px-6 pt-7 pb-5 gap-3">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={26} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">프로젝트 삭제</h3>
              <div className="text-center text-sm text-slate-600 space-y-1.5">
                {deleteConfirm.members.length > 0 ? (
                  <>
                    <p>이 프로젝트에 <span className="font-semibold text-slate-800">{deleteConfirm.members.length}명</span>이 배치되어 있습니다.</p>
                    {deleteConfirm.ibksCount > 0 && (
                      <p>삭제 시 <span className="font-semibold text-slate-800">IBKS {deleteConfirm.ibksCount}명</span>은 &apos;대기&apos;로 이동됩니다.</p>
                    )}
                    {deleteConfirm.partnerCount > 0 && (
                      <p>삭제 시 <span className="font-semibold text-red-600">협력사 {deleteConfirm.partnerCount}명</span>은 자동 삭제됩니다.</p>
                    )}
                  </>
                ) : (
                  <p>이 프로젝트를 삭제하시겠습니까?</p>
                )}
                <p className="pt-0.5 text-slate-500">계속하시겠습니까?</p>
              </div>
            </div>
            <div className="flex border-t border-slate-200">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">취소</button>
              <div className="w-px bg-slate-200" />
              <button onClick={doDeleteProject} className="flex-1 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">삭제</button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={() => setShowProjModal(false)} disabled={isProjSubmitting} className="px-4 py-2 text-sm border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">취소</button>
              <button onClick={saveProj} disabled={isProjSubmitting} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {isProjSubmitting ? "등록 중..." : (editingProj.id === null ? "등록" : "저장")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 알림 모달 */}
      {alertInfo && (
        <AlertModal
          title={alertInfo.title}
          message={alertInfo.message}
          onClose={() => setAlertInfo(null)}
        />
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
