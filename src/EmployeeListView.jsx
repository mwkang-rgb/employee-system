import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Plus, Edit2, Trash2, Download, Building2 } from "lucide-react";
import * as XLSX from "xlsx";
import { RANKS } from "./constants.js";
import { resolveStatus } from "./helpers.js";
import { COLOR_MAP } from "./constants.js";

function downloadTemplate() {
  const headers = ["이름", "소속", "직급", "직무", "역할", "투입형태", "투입프로젝트", "투입일자", "철수일자"];
  const example = ["홍길동", "IBKS", "차장", "DBA", "백엔드 개발", "비계약", "프로젝트명", "2026-06-01", "2026-12-31"];
  const note = ["※ 날짜 미정 시", "", "", "", "", "투입형태: 계약/비계약/지원/투입예정", "대기 입력 시 날짜 불필요", "1111-01-01", "9999-12-31"];
  const ws = XLSX.utils.aoa_to_sheet([headers, example, note]);
  ws["!cols"] = [12, 16, 10, 12, 16, 10, 20, 14, 14].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "직원정보");
  XLSX.writeFile(wb, "직원정보_업로드양식.xlsx");
}

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

// 정렬 가능한 테이블 헤더 셀
function Th({ field, sortField, onClick, SortIcon, className = "", children }) {
  return (
    <th
      className={`px-3 sm:px-4 py-3 text-left cursor-pointer select-none hover:bg-slate-100 whitespace-nowrap ${className}`}
      onClick={() => onClick(field)}
    >
      {children}<SortIcon field={field} />
    </th>
  );
}

const PAGE_SIZE = 15;

// props:
//   employees    — 전체 직원 목록
//   projects     — 전체 프로젝트 목록 (필터 드롭다운용)
//   projectById  — { [id]: project } 맵 (테이블 표시 + CSV)
//   partnerList  — 등록된 협력사 목록 (필터 드롭다운용)
//   onNewEmp     — "등록" 버튼 클릭 시
//   onEditEmp    — (emp) 수정 버튼 클릭 시
//   onDeleteEmp  — (id) 삭제 버튼 클릭 시
export default function EmployeeListView({
  employees, projects, projectById, partnerList,
  onNewEmp, onEditEmp, onDeleteEmp, onBulkUpload,
}) {
  const [query, setQuery] = useState("");
  const [filterRank, setFilterRank] = useState("전체");
  const [filterProject, setFilterProject] = useState("전체");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [filterAffiliation, setFilterAffiliation] = useState("전체");
  const [filterPartner, setFilterPartner] = useState("전체");
  const [filterDuty, setFilterDuty] = useState("전체");
  const [sortField, setSortField] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [showUploadWarning, setShowUploadWarning] = useState(false);
  const fileInputRef = useRef(null);

  // 필터 변경 시 1페이지로 복귀
  useEffect(() => {
    setPage(1);
  }, [query, filterRank, filterProject, filterStatus, filterAffiliation, filterPartner, filterDuty]);

  // 소속 필터가 협력사가 아니면 협력사 상세 필터 초기화
  useEffect(() => {
    if (filterAffiliation !== "협력사") setFilterPartner("전체");
  }, [filterAffiliation]);

  // 직무 목록 (필터 드롭다운용)
  const dutyList = useMemo(() => {
    const set = new Set(employees.map(e => (e.duty || "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [employees]);

  // 필터 + 정렬 적용
  const filtered = useMemo(() => {
    let list = employees.filter((e) => {
      const status = resolveStatus(e, projectById[e.projectId]?.name).label;
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
      if (sortField === "project") {
        va = projectById[a.projectId]?.name || "";
        vb = projectById[b.projectId]?.name || "";
      }
      if (sortField === "affiliation") {
        va = a.affiliation === "IBKS" ? "IBKS" : (a.partnerName || "협력사");
        vb = b.affiliation === "IBKS" ? "IBKS" : (b.partnerName || "협력사");
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [employees, query, filterRank, filterProject, filterStatus, filterAffiliation, filterPartner, filterDuty, sortField, sortDir, projectById]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const exportCSV = () => {
    const header = ["ID", "직원명", "직급", "소속", "협력사명", "직무", "역할", "투입프로젝트", "투입일자", "철수일자", "상태"];
    const rows = filtered.map((e) => [
      e.id, e.name, e.rank, e.affiliation, e.partnerName || "",
      e.duty || "", e.role || "",
      projectById[e.projectId]?.name || "",
      (!e.startDate || e.startDate === "1111-01-01") ? "-" : e.startDate,
      (!e.endDate || e.endDate === "9999-12-31") ? "-" : e.endDate,
      resolveStatus(e, projectById[e.projectId]?.name).label,
    ]);
    const csv = "﻿" + [header, ...rows].map((r) => r.join(",")).join("\n");
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
    <>
      {/* 검색 + 필터 바 */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 mb-4">
        <div className="relative mb-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="직원명·직급·직무·역할·프로젝트·협력사명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
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
            <option value="대기">대기</option>
            <option value="투입예정">투입예정</option>
            <option value="투입중">투입중</option>
            <option value="철수">철수</option>
          </select>
          <button onClick={exportCSV} className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white hover:bg-slate-50 flex items-center gap-1 text-slate-700 flex-shrink-0">
            <Download size={14} /> CSV
          </button>
          <button onClick={downloadTemplate} className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white hover:bg-slate-50 flex items-center gap-1 text-slate-700 flex-shrink-0">
            📥 양식 다운로드
          </button>
          <button onClick={() => setShowUploadWarning(true)} className="px-3 py-2 text-sm border border-emerald-300 rounded-md bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1 text-emerald-700 flex-shrink-0">
            📤 직원정보 업로드
          </button>
          <button onClick={onNewEmp} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1 font-medium flex-shrink-0 ml-auto sm:ml-0">
            <Plus size={14} /> 등록
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          총 <span className="font-semibold text-slate-700">{filtered.length}</span>건 / 전체 {employees.length}건
        </div>
      </div>

      {/* 직원 테이블 */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" style={{ minWidth: "1100px" }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <Th field="id" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon} className="w-12 text-center">No</Th>
                <Th field="name" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>직원명</Th>
                <Th field="affiliation" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>소속</Th>
                <Th field="rank" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>직급</Th>
                <Th field="duty" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>직무</Th>
                <Th field="role" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>역할</Th>
                <Th field="project" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>투입 프로젝트</Th>
                <Th field="startDate" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>투입일자</Th>
                <Th field="endDate" sortField={sortField} onClick={toggleSort} SortIcon={SortIcon}>철수일자</Th>
                <th className="px-3 sm:px-4 py-3 text-center">상태</th>
                <th className="px-3 sm:px-4 py-3 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400">검색 결과가 없습니다.</td></tr>
              ) : paged.map((e) => {
                const proj = projectById[e.projectId];
                const status = resolveStatus(e, proj?.name);
                const c = COLOR_MAP[proj?.color || "slate"];
                return (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-3 sm:px-4 py-3 text-center text-slate-500">{e.id}</td>
                    <td className="px-3 sm:px-4 py-3 text-left font-medium text-slate-900">{e.name}</td>
                    <td className="px-3 sm:px-4 py-3 text-left"><AffiliationBadge affiliation={e.affiliation} partnerName={e.partnerName} /></td>
                    <td className="px-3 sm:px-4 py-3 text-left text-slate-700">{e.rank}</td>
                    <td className="px-3 sm:px-4 py-3 text-left text-slate-700">{e.duty || <span className="text-slate-300">-</span>}</td>
                    <td className="px-3 sm:px-4 py-3 text-left text-slate-600">{e.role || <span className="text-slate-300">-</span>}</td>
                    <td className="px-3 sm:px-4 py-3 text-left text-slate-700">
                      {e.projectId === "pool" || !proj || proj.name === "대기" ? (
                        <span className="text-slate-300">-</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${c.dot} flex-shrink-0`}></span>
                          {proj.name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-left text-slate-600 tabular-nums">
                      {e.startDate === "1111-01-01" || !e.startDate ? <span className="text-slate-300">-</span> : e.startDate}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-left text-slate-600 tabular-nums">
                      {e.endDate === "9999-12-31" || !e.endDate ? <span className="text-slate-300">-</span> : e.endDate}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${status.color}`}>{status.label}</span>
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => onEditEmp(e)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="수정"><Edit2 size={14} /></button>
                        <button onClick={() => onDeleteEmp(e.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="삭제"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs sm:text-sm">
            <div className="text-slate-600 whitespace-nowrap">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
            </div>
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

      {showUploadWarning && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-3">⚠️ 직원정보 일괄 업로드</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              업로드한 파일의 데이터로 직원 정보가 등록됩니다.<br />
              이름이 동일한 직원이 있을 경우 기존 데이터가 덮어씌워질 수 있습니다.<br /><br />
              계속하시겠습니까?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowUploadWarning(false)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-700"
              >
                취소
              </button>
              <button
                onClick={() => { setShowUploadWarning(false); fileInputRef.current?.click(); }}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
              >
                계속
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { onBulkUpload(file); e.target.value = ""; }
        }}
      />
    </>
  );
}
