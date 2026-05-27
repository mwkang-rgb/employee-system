import React, { useState, useMemo, useEffect } from "react";
import { Search, Plus, Edit2, Trash2, X, Users, Briefcase, Calendar, Filter, Download, FolderKanban, LayoutList, GripVertical, FolderPlus, Building2 } from "lucide-react";
import {
  RANKS, AFFILIATIONS, SAMPLE_PARTNERS, SAMPLE_DUTIES, SAMPLE_ROLES,
  ASSIGNMENT_TYPES, ASSIGNMENT_TYPE_STYLES, RANK_ORDER, POOL_SORT_OPTIONS,
  INITIAL_PROJECTS, SURNAMES, GIVEN_NAMES, COLOR_MAP, COLOR_OPTIONS,
} from "./constants.js";

const randomDate = (start, end) => {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().slice(0, 10);
};

const generateSampleData = (projects) => {
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

const getStatus = (startDate, endDate, projectId) => {
  if (projectId === "pool") return { label: "대기", color: "bg-amber-50 text-amber-700 border-amber-200" };
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return { label: "예정", color: "bg-slate-50 text-slate-600 border-slate-200" };
  if (today > endDate) return { label: "종료", color: "bg-zinc-100 text-zinc-500 border-zinc-200" };
  return { label: "투입중", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// 직원의 현재 투입 정보를 assignmentHistory에 누적
// emp: 현재 직원 객체, projectsMap: id→project, options: { closeEndDate?: 오늘로 종료 처리할지 }
const archiveCurrentAssignment = (emp, projectsMap, options = {}) => {
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
const calcWaitingDuration = (pooledAt) => {
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
const formatWaitingLabel = (pooledAt) => {
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

// 소속 표시용 배지
const AffiliationBadge = ({ affiliation, partnerName }) => {
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
};

export default function EmployeeManager() {
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [employees, setEmployees] = useState([]);
  const [view, setView] = useState("list");

  const [query, setQuery] = useState("");
  const [filterRank, setFilterRank] = useState("전체");
  const [filterProject, setFilterProject] = useState("전체");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [filterAffiliation, setFilterAffiliation] = useState("전체");
  const [filterPartner, setFilterPartner] = useState("전체");
  const [filterDuty, setFilterDuty] = useState("전체");
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [sortField, setSortField] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [boardQuery, setBoardQuery] = useState("");
  const [showProjModal, setShowProjModal] = useState(false);
  const [editingProj, setEditingProj] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverProj, setDragOverProj] = useState(null);
  // 대기 컬럼 전용 정렬: waitingDays | endDate | startDate | rank | duty | name | added
  const [poolSortField, setPoolSortField] = useState("waitingDays");
  const [poolSortDir, setPoolSortDir] = useState("desc");
  // 카드 상세 보기 팝업 (대기 카드 클릭 시)
  const [detailEmp, setDetailEmp] = useState(null);

  useEffect(() => {
    setEmployees(generateSampleData(INITIAL_PROJECTS));
  }, []);

  // 데이터 무결성 가드: 협력사 직원이 pool에 존재하면 자동 제거
  // (외부 입력, 데이터 마이그레이션, 예외 케이스 등 모든 경로 방어)
  useEffect(() => {
    const hasInvalid = employees.some(e => e.affiliation === "협력사" && e.projectId === "pool");
    if (hasInvalid) {
      setEmployees(prev => prev.filter(e => !(e.affiliation === "협력사" && e.projectId === "pool")));
    }
  }, [employees]);

  const projectById = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);

  // 실제 등록된 협력사 목록 (필터용)
  const partnerList = useMemo(() => {
    const set = new Set(
      employees
        .filter(e => e.affiliation === "협력사" && e.partnerName?.trim())
        .map(e => e.partnerName.trim())
    );
    return Array.from(set).sort();
  }, [employees]);

  // 등록된 직무·역할 목록 (필터 + 자동완성용)
  const dutyList = useMemo(() => {
    const set = new Set(employees.map(e => (e.duty || "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [employees]);
  const roleList = useMemo(() => {
    const set = new Set(employees.map(e => (e.role || "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    let list = employees.filter((e) => {
      const status = getStatus(e.startDate, e.endDate, e.projectId).label;
      const projName = projectById[e.projectId]?.name || "";
      const q = query.trim().toLowerCase();
      const matchQuery = !q
        || e.name.toLowerCase().includes(q)
        || e.rank.toLowerCase().includes(q)
        || projName.toLowerCase().includes(q)
        || (e.partnerName || "").toLowerCase().includes(q)
        || (e.duty || "").toLowerCase().includes(q)
        || (e.role || "").toLowerCase().includes(q);
      const matchRank = filterRank === "전체" || e.rank === filterRank;
      const matchProj = filterProject === "전체" || e.projectId === filterProject;
      const matchStatus = filterStatus === "전체" || status === filterStatus;
      const matchAffil = filterAffiliation === "전체" || e.affiliation === filterAffiliation;
      const matchPartner = filterPartner === "전체" || e.partnerName === filterPartner;
      const matchDuty = filterDuty === "전체" || (e.duty || "") === filterDuty;
      return matchQuery && matchRank && matchProj && matchStatus && matchAffil && matchPartner && matchDuty;
    });

    list.sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === "project") { va = projectById[a.projectId]?.name || ""; vb = projectById[b.projectId]?.name || ""; }
      if (sortField === "affiliation") {
        va = a.affiliation === "IBKS" ? "IBKS" : (a.partnerName || "협력사");
        vb = b.affiliation === "IBKS" ? "IBKS" : (b.partnerName || "협력사");
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [employees, query, filterRank, filterProject, filterStatus, filterAffiliation, filterPartner, sortField, sortDir, projectById]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [query, filterRank, filterProject, filterStatus, filterAffiliation, filterPartner, filterDuty]);

  // 소속 필터가 IBKS로 바뀌거나 전체로 초기화되면 협력사 필터도 초기화
  useEffect(() => {
    if (filterAffiliation !== "협력사") setFilterPartner("전체");
  }, [filterAffiliation]);

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

    // IBKS로 저장 시 partnerName 초기화
    const isMovingToPool = editingEmp.projectId === "pool";
    const prevEmp = editingEmp.id !== null ? employees.find(e => e.id === editingEmp.id) : null;
    const wasInPool = prevEmp?.projectId === "pool";
    // 프로젝트가 실제로 변경되었는지 (pool 이탈, pool 진입, 다른 프로젝트로 전환) 확인
    const projectChanged = prevEmp && prevEmp.projectId !== editingEmp.projectId;
    const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
    let nextHistory = editingEmp.assignmentHistory || [];
    if (projectChanged && prevEmp.projectId && prevEmp.projectId !== "pool") {
      // 이전 프로젝트의 투입 이력을 archive
      nextHistory = archiveCurrentAssignment(prevEmp, projMap, { closeEndDate: true });
    }

    const toSave = {
      ...editingEmp,
      partnerName: editingEmp.affiliation === "IBKS" ? "" : editingEmp.partnerName.trim(),
      duty: (editingEmp.duty || "").trim(),
      role: (editingEmp.role || "").trim(),
      // pool 진입 시 pooledAt 새로 기록(이미 pool에 있던 경우 기존값 유지), pool 이탈 시 null
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
          // 투입 이력에 archive (오늘 날짜로 종료 처리)
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
        // 대기 컬럼은 항상 맨 앞에 유지, 새 프로젝트는 마지막에 추가
        return [pool, ...others, { ...editingProj, id: newId }].filter(Boolean);
      });
    } else {
      setProjects(prev => prev.map(p => p.id === editingProj.id ? editingProj : p));
    }
    setShowProjModal(false);
    setEditingProj(null);
  };

  const onDragStart = (e, empId) => {
    setDragId(empId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(empId));
  };
  const onDragEnd = () => { setDragId(null); setDragOverProj(null); };
  const onDragOver = (e, projId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverProj !== projId) setDragOverProj(projId);
  };
  const onDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverProj(null);
  };
  const onDrop = (e, projId) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/plain"));
    setDragId(null);
    setDragOverProj(null);
    if (Number.isNaN(id)) return;

    setEmployees(prev => {
      const emp = prev.find(x => x.id === id);
      if (!emp) return prev;
      // 같은 컬럼으로 드롭 시 변경 없음
      if (emp.projectId === projId) return prev;
      // 협력사 직원을 대기(pool)로 이동 시 자동 삭제 (계약 종료 처리)
      if (projId === "pool" && emp.affiliation === "협력사") {
        return prev.filter(x => x.id !== id);
      }
      const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
      // 이전 투입(현재 프로젝트) 이력을 누적
      const newHistory = archiveCurrentAssignment(emp, projMap, { closeEndDate: true });
      // 일반 이동: pool 진입 시 pooledAt 기록, pool 이탈 시 클리어
      return prev.map(x => {
        if (x.id !== id) return x;
        if (projId === "pool") return { ...x, projectId: projId, pooledAt: todayISO(), assignmentHistory: newHistory };
        return { ...x, projectId: projId, pooledAt: null, assignmentHistory: newHistory };
      });
    });
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const exportCSV = () => {
    const header = ["ID", "직원명", "직급", "소속", "협력사명", "직무", "역할", "투입프로젝트", "투입일자", "철수일자", "상태"];
    const rows = filtered.map((e) => [
      e.id, e.name, e.rank, e.affiliation, e.partnerName || "",
      e.duty || "", e.role || "",
      projectById[e.projectId]?.name || "", e.startDate, e.endDate,
      getStatus(e.startDate, e.endDate, e.projectId).label,
    ]);
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `직원투입현황_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-slate-700 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
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

        {/* 통계 카드: 모바일·태블릿은 가로 스크롤, 큰 화면(lg↑)에서만 5열 그리드 */}
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
          <>
            <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 mb-4">
              {/* 검색창: 모바일은 풀폭 별행 */}
              <div className="relative mb-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="직원명·직급·직무·역할·프로젝트·협력사명 검색" value={query} onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              {/* 필터 버튼들: 모바일에서 가로 스크롤 */}
              <div className="flex gap-2 items-center overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap pb-1 sm:pb-0">
                <select value={filterAffiliation} onChange={(e) => setFilterAffiliation(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0">
                  <option value="전체">소속 전체</option>
                  <option value="IBKS">IBKS</option>
                  <option value="협력사">협력사</option>
                </select>
                {filterAffiliation === "협력사" && (
                  <select value={filterPartner} onChange={(e) => setFilterPartner(e.target.value)} className="px-3 py-2 text-sm border border-amber-300 rounded-md bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-500 flex-shrink-0 max-w-[180px]">
                    <option value="전체">협력사 전체</option>
                    {partnerList.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
                <select value={filterRank} onChange={(e) => setFilterRank(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0">
                  <option value="전체">직급 전체</option>
                  {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={filterDuty} onChange={(e) => setFilterDuty(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0 max-w-[160px]">
                  <option value="전체">직무 전체</option>
                  {dutyList.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0 max-w-[200px]">
                  <option value="전체">프로젝트 전체</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0">
                  <option value="전체">상태 전체</option>
                  <option value="투입중">투입중</option>
                  <option value="예정">예정</option>
                  <option value="종료">종료</option>
                  <option value="대기">대기</option>
                </select>
                <button onClick={exportCSV} className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white hover:bg-slate-50 flex items-center gap-1 text-slate-700 flex-shrink-0">
                  <Download size={14} /> CSV
                </button>
                <button onClick={openNewEmp} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1 font-medium flex-shrink-0 ml-auto sm:ml-0">
                  <Plus size={14} /> 등록
                </button>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                총 <span className="font-semibold text-slate-700">{filtered.length}</span>건 / 전체 {employees.length}건
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="text-sm whitespace-nowrap" style={{ minWidth: "1100px" }}>
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <Th field="id" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon} className="w-12">No</Th>
                      <Th field="name" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>직원명</Th>
                      <Th field="affiliation" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>소속</Th>
                      <Th field="rank" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>직급</Th>
                      <Th field="duty" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>직무</Th>
                      <Th field="role" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>역할</Th>
                      <Th field="project" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>투입 프로젝트</Th>
                      <Th field="startDate" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>투입일자</Th>
                      <Th field="endDate" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>철수일자</Th>
                      <th className="px-3 sm:px-4 py-3">상태</th>
                      <th className="px-3 sm:px-4 py-3 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.length === 0 ? (
                      <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400">검색 결과가 없습니다.</td></tr>
                    ) : paged.map((e) => {
                      const status = getStatus(e.startDate, e.endDate, e.projectId);
                      const proj = projectById[e.projectId];
                      const c = COLOR_MAP[proj?.color || "slate"];
                      return (
                        <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-3 sm:px-4 py-3 text-slate-500">{e.id}</td>
                          <td className="px-3 sm:px-4 py-3 font-medium text-slate-900">{e.name}</td>
                          <td className="px-3 sm:px-4 py-3"><AffiliationBadge affiliation={e.affiliation} partnerName={e.partnerName} /></td>
                          <td className="px-3 sm:px-4 py-3 text-slate-700">{e.rank}</td>
                          <td className="px-3 sm:px-4 py-3 text-slate-700">{e.duty || <span className="text-slate-300">-</span>}</td>
                          <td className="px-3 sm:px-4 py-3 text-slate-600">{e.role || <span className="text-slate-300">-</span>}</td>
                          <td className="px-3 sm:px-4 py-3 text-slate-700">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${c.dot} flex-shrink-0`}></span>
                              {proj?.name || "-"}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-slate-600 tabular-nums">{e.startDate}</td>
                          <td className="px-3 sm:px-4 py-3 text-slate-600 tabular-nums">{e.endDate}</td>
                          <td className="px-3 sm:px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${status.color}`}>{status.label}</span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-right">
                            <button onClick={() => openEditEmp(e)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="수정"><Edit2 size={14} /></button>
                            <button onClick={() => removeEmp(e.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-1" title="삭제"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filtered.length > 0 && (
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs sm:text-sm">
                  <div className="text-slate-600 whitespace-nowrap">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / {filtered.length}</div>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100">«</button>
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100">‹</button>
                    <span className="px-3 py-1 bg-indigo-600 text-white rounded font-medium">{page} / {totalPages}</span>
                    <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100">›</button>
                    <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100">»</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {view === "board" && (
          <>
            <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 mb-4">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1 min-w-0">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="직원명, 직급, 협력사명" value={boardQuery} onChange={(e) => setBoardQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <button onClick={openNewProj} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1 font-medium flex-shrink-0">
                  <FolderPlus size={14} /> <span className="hidden sm:inline">프로젝트 </span>등록
                </button>
              </div>
              <div className="mt-2 text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5">
                <GripVertical size={12} className="flex-shrink-0" /> <span className="hidden sm:inline">직원 카드를 다른 프로젝트 컬럼으로 드래그하여 배치를 변경할 수 있습니다.</span><span className="sm:hidden">카드를 길게 눌러 다른 컬럼으로 드래그하세요.</span>
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0" style={{ minHeight: "600px" }}>
              {projects.map((proj) => {
                const c = COLOR_MAP[proj.color] || COLOR_MAP.slate;
                const q = boardQuery.trim().toLowerCase();
                const isPool = proj.id === "pool";
                let members = employees
                  .filter(e => e.projectId === proj.id)
                  .filter(e => !q || e.name.toLowerCase().includes(q) || e.rank.toLowerCase().includes(q) || (e.partnerName || "").toLowerCase().includes(q) || (e.duty || "").toLowerCase().includes(q) || (e.role || "").toLowerCase().includes(q));

                // 대기 컬럼은 사용자가 선택한 기준으로 정렬
                if (isPool) {
                  const dirMul = poolSortDir === "asc" ? 1 : -1;
                  members = [...members].sort((a, b) => {
                    let va, vb;
                    switch (poolSortField) {
                      case "waitingDays":
                        // 대기 시작일이 빠를수록 대기일수가 길다 → pooledAt asc로 비교
                        va = a.pooledAt || "9999-12-31";
                        vb = b.pooledAt || "9999-12-31";
                        // 사용자 직관: 내림차순(desc)이면 "오래 대기한 사람부터"가 자연스러움
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
                    // 보조 정렬: 같은 값일 때 직급 순
                    const ra = RANK_ORDER[a.rank] ?? 99;
                    const rb = RANK_ORDER[b.rank] ?? 99;
                    return ra - rb;
                  });
                }

                const isOver = dragOverProj === proj.id;
                // 협력사 직원을 대기로 드래그 중인 상황 감지
                const draggedEmp = dragId !== null ? employees.find(x => x.id === dragId) : null;
                const isPartnerDropWarning = isPool && isOver && draggedEmp?.affiliation === "협력사";

                return (
                  <div key={proj.id}
                    onDragOver={(e) => onDragOver(e, proj.id)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, proj.id)}
                    className={`flex-shrink-0 w-64 sm:w-72 rounded-lg border-2 ${
                      isPartnerDropWarning ? "border-red-400 bg-red-50/40" :
                      isOver ? "border-indigo-400 bg-indigo-50/30" :
                      `${c.border} ${c.bg}`
                    } flex flex-col transition-colors`}>
                    <div className={`px-3 py-2.5 border-b ${c.border} ${c.header} rounded-t-md flex items-center justify-between`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full ${c.dot} flex-shrink-0`}></span>
                        <span className={`font-bold text-sm ${c.text} truncate`}>{proj.name}</span>
                        <span className={`px-1.5 py-0.5 text-xs font-semibold rounded bg-white/70 ${c.text} flex-shrink-0`}>{members.length}</span>
                      </div>
                      {!isPool && (
                        <div className="flex gap-0.5 flex-shrink-0">
                          <button onClick={() => openEditProj(proj)} className={`p-1 rounded hover:bg-white/70 ${c.text}`} title="프로젝트 수정"><Edit2 size={12} /></button>
                          <button onClick={() => removeProj(proj.id)} className="p-1 rounded hover:bg-white/70 text-slate-500 hover:text-red-600" title="프로젝트 삭제"><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>

                    {/* 대기 컬럼 안내 문구 + 통계 */}
                    {isPool && (
                      <div className={`px-3 py-1.5 text-[11px] border-b ${c.border} ${
                        isPartnerDropWarning ? "bg-red-100 text-red-700 font-semibold" : "bg-white/50 text-slate-600"
                      }`}>
                        {isPartnerDropWarning ? (
                          "⚠ 협력사 직원은 대기로 이동 시 자동 삭제됩니다"
                        ) : (() => {
                          const withDates = members.filter(m => m.pooledAt);
                          if (withDates.length === 0) return "대기 인력이 없습니다";
                          const durations = withDates.map(m => calcWaitingDuration(m.pooledAt).days);
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

                    <div className="p-2 space-y-2 overflow-y-auto flex-1" style={{ maxHeight: "650px" }}>
                      {members.length === 0 && (
                        <div className="text-center text-xs text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-md">
                          {isOver ? (isPartnerDropWarning ? "여기 놓으면 자동 삭제" : "여기에 놓기") : "배치된 인원 없음"}
                        </div>
                      )}
                      {members.map((emp) => {
                        const status = getStatus(emp.startDate, emp.endDate, emp.projectId);
                        const isDragging = dragId === emp.id;
                        const waitingLabel = isPool ? formatWaitingLabel(emp.pooledAt) : "";
                        const waitingDur = isPool ? calcWaitingDuration(emp.pooledAt) : null;
                        // 대기일수에 따른 색상 강조: 90일 이상 빨강, 30일 이상 주황, 그 외 기본
                        const waitingColor = !waitingDur ? "bg-amber-50 text-amber-700 border-amber-200"
                          : waitingDur.days >= 90 ? "bg-red-50 text-red-700 border-red-200"
                          : waitingDur.days >= 30 ? "bg-orange-50 text-orange-700 border-orange-200"
                          : "bg-amber-50 text-amber-700 border-amber-200";
                        return (
                          <div key={emp.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, emp.id)}
                            onDragEnd={onDragEnd}
                            onClick={() => setDetailEmp(emp)}
                            className={`bg-white rounded-md border border-slate-200 p-2.5 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all ${isDragging ? "opacity-40 scale-95" : ""}`}
                            title="클릭하여 상세 보기">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <GripVertical size={12} className="text-slate-300 flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="font-semibold text-sm text-slate-900 truncate">{emp.name}</div>
                                  <div className="text-xs text-slate-500">{emp.rank}</div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                <span className={`text-[10px] px-1.5 py-0.5 font-medium rounded border ${status.color}`}>
                                  {status.label}
                                </span>
                                {isPool && waitingLabel && (
                                  <span className={`text-[10px] px-1.5 py-0.5 font-semibold rounded border ${waitingColor} tabular-nums`} title={emp.pooledAt ? `대기 시작: ${emp.pooledAt}` : ""}>
                                    {waitingLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <AffiliationBadge affiliation={emp.affiliation} partnerName={emp.partnerName} />
                              {emp.duty && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border bg-slate-50 text-slate-600 border-slate-200">
                                  {emp.duty}
                                </span>
                              )}
                            </div>
                            {emp.role && (
                              <div className="mt-1 text-[11px] text-slate-500 truncate" title={emp.role}>
                                · {emp.role}
                              </div>
                            )}
                            {isPool && emp.pooledAt ? (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 tabular-nums flex justify-between">
                                <span className="text-slate-400">대기 시작</span>
                                <span>{emp.pooledAt}</span>
                              </div>
                            ) : (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 tabular-nums flex justify-between">
                                <span>{emp.startDate}</span>
                                <span className="text-slate-300">→</span>
                                <span>{emp.endDate}</span>
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
        )}
      </div>

      {/* 직원 모달 */}
      {showEmpModal && editingEmp && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-2 sm:p-4 z-50" onClick={() => setShowEmpModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[95vh]" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "28rem" }}>
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">{editingEmp.id === null ? "직원 등록" : "직원 정보 수정"}</h2>
              <button onClick={() => setShowEmpModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto overflow-x-hidden flex-1">
              <Field label="직원명 *">
                <input type="text" value={editingEmp.name} onChange={(e) => setEditingEmp({ ...editingEmp, name: e.target.value })} className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="홍길동" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="소속 *">
                  <select value={editingEmp.affiliation} onChange={(e) => setEditingEmp({ ...editingEmp, affiliation: e.target.value })} className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>
                <Field label="직급 *">
                  <select value={editingEmp.rank} onChange={(e) => setEditingEmp({ ...editingEmp, rank: e.target.value })} className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
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

              {/* 직무 · 역할: 소속 무관 공통 수기 입력 */}
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
                <select value={editingEmp.assignmentType || "비계약"} onChange={(e) => setEditingEmp({ ...editingEmp, assignmentType: e.target.value })} className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {ASSIGNMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {editingEmp.assignmentType && ASSIGNMENT_TYPE_STYLES[editingEmp.assignmentType] && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    {ASSIGNMENT_TYPE_STYLES[editingEmp.assignmentType].desc}
                  </div>
                )}
              </Field>

              <Field label="투입 프로젝트 *">
                <select value={editingEmp.projectId} onChange={(e) => setEditingEmp({ ...editingEmp, projectId: e.target.value })} className="w-full px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {editingEmp.affiliation === "협력사" && editingEmp.projectId === "pool" && (
                  <div className="mt-1.5 text-[11px] text-red-600 font-medium flex items-center gap-1">
                    ⚠ 협력사 직원을 '대기'로 지정하면 저장 시 자동 삭제됩니다.
                  </div>
                )}
              </Field>
              <Field label="투입일자 *">
                <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}>
                  <input
                    type="date"
                    value={editingEmp.startDate}
                    onChange={(e) => setEditingEmp({ ...editingEmp, startDate: e.target.value })}
                    className="block px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{
                      width: "100%",
                      minWidth: 0,
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      minHeight: "42px",
                      WebkitAppearance: "textfield",
                      MozAppearance: "textfield",
                    }}
                  />
                </div>
              </Field>
              <Field label="철수일자 *">
                <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}>
                  <input
                    type="date"
                    value={editingEmp.endDate}
                    onChange={(e) => setEditingEmp({ ...editingEmp, endDate: e.target.value })}
                    className="block px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{
                      width: "100%",
                      minWidth: 0,
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      minHeight: "42px",
                      WebkitAppearance: "textfield",
                      MozAppearance: "textfield",
                    }}
                  />
                </div>
              </Field>
            </div>
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 flex-shrink-0">
              <button onClick={() => setShowEmpModal(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-700">취소</button>
              <button onClick={saveEmp} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">{editingEmp.id === null ? "등록" : "저장"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 카드 상세 보기 팝업 (대기 카드 클릭 시) */}
      {detailEmp && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-2 sm:p-4 z-50" onClick={() => setDetailEmp(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[95vh]" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "28rem" }}>
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex-shrink-0">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">직원 상세</div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                  {detailEmp.name} <span className="text-sm font-medium text-slate-500">{detailEmp.rank}</span>
                </h2>
              </div>
              <button onClick={() => setDetailEmp(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0"><X size={22} /></button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex flex-wrap gap-1.5">
                <AffiliationBadge affiliation={detailEmp.affiliation} partnerName={detailEmp.partnerName} />
                {detailEmp.duty && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-slate-50 text-slate-700 border-slate-200">
                    {detailEmp.duty}
                  </span>
                )}
                {detailEmp.assignmentType && (
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border ${ASSIGNMENT_TYPE_STYLES[detailEmp.assignmentType]?.badge || "bg-slate-50 text-slate-700 border-slate-200"}`}>
                    {detailEmp.assignmentType}
                  </span>
                )}
              </div>

              {/* 현재 투입 정보 (대기 인력 제외) */}
              {detailEmp.projectId !== "pool" && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase size={13} /> 현재 투입 정보
                  </div>
                  <div className="p-3 space-y-2.5">
                    <DetailRow label="투입 프로젝트">
                      <span className="font-semibold text-slate-900">{projectById[detailEmp.projectId]?.name || "-"}</span>
                    </DetailRow>
                    <DetailRow label="투입일자">
                      <span className="tabular-nums text-slate-700">{detailEmp.startDate || "-"}</span>
                    </DetailRow>
                    <DetailRow label="철수일자">
                      <span className="tabular-nums text-slate-700">{detailEmp.endDate || "-"}</span>
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
              {detailEmp.projectId === "pool" && detailEmp.pooledAt && (() => {
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

              {/* 투입 이력 타임라인 (누적) */}
              {(() => {
                const history = (detailEmp.assignmentHistory || []).slice().reverse(); // 최신이 위
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
                              {/* 세로 연결선: 마지막 항목 제외, 다음 항목까지 자연스럽게 연장 */}
                              {!isLast && (
                                <span className="absolute left-[5px] top-[18px] bottom-[-16px] w-px bg-slate-200" aria-hidden />
                              )}
                              {/* 타임라인 점: 프로젝트명 첫 글자 높이에 정렬 (top 6px = (텍스트 높이 - 점 높이) / 2 보정) */}
                              <span
                                className={`absolute left-0 top-[6px] w-3 h-3 rounded-full ${dotColor} ring-2 ring-white shadow-[0_0_0_1px_rgba(0,0,0,0.04)]`}
                                aria-hidden
                              />
                              {/* 본문 */}
                              <div className="flex items-start justify-between gap-2 min-w-0">
                                <div
                                  className="font-semibold text-sm text-slate-900 truncate min-w-0 flex-1"
                                  title={h.projectName}
                                >
                                  {h.projectName}
                                </div>
                                {h.assignmentType && typeStyle && (
                                  <span className={`text-[10px] px-1.5 py-0.5 font-semibold rounded border flex-shrink-0 ${typeStyle.badge}`}>
                                    {h.assignmentType}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500 tabular-nums truncate" title={`${h.startDate || "?"} → ${h.endDate || "?"}`}>
                                {h.startDate || "?"} → {h.endDate || "?"}
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

              {detailEmp.role && (
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">역할</div>
                  <div className="text-sm text-slate-700">{detailEmp.role}</div>
                </div>
              )}
            </div>

            <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 flex-shrink-0">
              <button
                onClick={() => {
                  const target = detailEmp;
                  setDetailEmp(null);
                  setEditingEmp({ ...target });
                  setShowEmpModal(true);
                }}
                className="px-4 py-2 text-sm border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-700 flex items-center gap-1"
              >
                <Edit2 size={13} /> 정보 수정
              </button>
              <button onClick={() => setDetailEmp(null)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">닫기</button>
            </div>
          </div>
        </div>
      )}

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

function Th({ field, sortField, onClick, SortIcon, className = "", children }) {
  return (
    <th className={`px-3 sm:px-4 py-3 cursor-pointer select-none hover:bg-slate-100 whitespace-nowrap ${className}`} onClick={() => onClick(field)}>
      {children}<SortIcon field={field} />
    </th>
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

function DetailRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-xs text-slate-500 font-medium flex-shrink-0">{label}</span>
      <div className="text-right min-w-0 truncate">{children}</div>
    </div>
  );
}
