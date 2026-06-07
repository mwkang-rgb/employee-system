import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Users, Clock, CheckCircle, XCircle, Search,
  ArrowLeft, LogOut, UserCheck, UserX, AlertCircle, X,
} from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../AuthContext.jsx";

/* ── 상태 배지 ─────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const cfg = {
    pending:  { label: "대기", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    approved: { label: "승인", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "반려", cls: "bg-red-50 text-red-700 border-red-200" },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

/* ── 통계 카드 ─────────────────────────────────────────────── */
function StatCard({ icon, label, value, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

/* ── 사용자 아바타 ──────────────────────────────────────────── */
function Avatar({ user, size = "sm" }) {
  const dim = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt="" className={`${dim} rounded-full flex-shrink-0 object-cover`} />;
  }
  const initial = (user.full_name?.[0] ?? user.email?.[0] ?? "?").toUpperCase();
  return (
    <div className={`${dim} rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 flex-shrink-0`}>
      {initial}
    </div>
  );
}

/* ── 반려 모달 ─────────────────────────────────────────────── */
function RejectModal({ target, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm(target.id, reason.trim() || null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">가입 반려 처리</h3>
            <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={18} className="text-slate-500" />
            </button>
          </div>

          <div className="bg-slate-50 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
            <Avatar user={target} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{target.full_name ?? "(이름 없음)"}</p>
              <p className="text-xs text-slate-500 truncate">{target.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              반려 사유 <span className="font-normal text-slate-400">(선택)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
              placeholder="반려 사유를 입력하세요 (생략 가능)"
              autoFocus
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 font-medium transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={busy}
              className="flex-1 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <UserX size={14} />
              {busy ? "처리 중…" : "반려 처리"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 메인 페이지 ────────────────────────────────────────────── */
export default function UserApprovalsPage() {
  const { user: adminUser, signOut } = useAuth();
  const [users, setUsers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [dateFilter, setDateFilter] = useState("all");
  const [actionBusy, setActionBusy] = useState(null); // userId being processed

  const loadUsers = useCallback(async () => {
    setDataLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id, email, full_name, avatar_url,
        approval_status, role, requested_at,
        approved_at, rejected_at, rejected_reason
      `)
      .order("requested_at", { ascending: false });

    if (error) {
      setFetchError("사용자 목록을 불러오지 못했습니다.");
    } else {
      setUsers(data ?? []);
    }
    setDataLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  /* ── 통계 ──────────────────────────────────────────────────── */
  const stats = useMemo(() => ({
    total:    users.length,
    pending:  users.filter(u => u.approval_status === "pending").length,
    approved: users.filter(u => u.approval_status === "approved").length,
    rejected: users.filter(u => u.approval_status === "rejected").length,
  }), [users]);

  /* ── 필터 ──────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const now = Date.now();
    return users.filter(u => {
      if (statusFilter !== "all" && u.approval_status !== statusFilter) return false;
      if (dateFilter !== "all") {
        const days = Number(dateFilter);
        if (now - new Date(u.requested_at).getTime() > days * 86400_000) return false;
      }
      if (q) {
        return (
          (u.full_name ?? "").toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, statusFilter, dateFilter, search]);

  /* ── 승인 처리 ─────────────────────────────────────────────── */
  async function handleApprove(userId) {
    setActionBusy(userId);
    const { error } = await supabase
      .from("profiles")
      .update({
        approval_status: "approved",
        approved_at:     new Date().toISOString(),
        approved_by:     adminUser.id,
        rejected_at:     null,
        rejected_by:     null,
        rejected_reason: null,
      })
      .eq("id", userId)
      .eq("approval_status", "pending");

    setActionBusy(null);
    if (error) {
      alert("승인 처리 중 오류가 발생했습니다.");
      return;
    }
    await loadUsers();
  }

  /* ── 반려 처리 ─────────────────────────────────────────────── */
  async function handleReject(userId, reason) {
    const { error } = await supabase
      .from("profiles")
      .update({
        approval_status: "rejected",
        rejected_at:     new Date().toISOString(),
        rejected_by:     adminUser.id,
        rejected_reason: reason ?? null,
        approved_at:     null,
        approved_by:     null,
      })
      .eq("id", userId)
      .eq("approval_status", "pending");

    if (error) {
      alert("반려 처리 중 오류가 발생했습니다.");
      return;
    }
    setRejectTarget(null);
    await loadUsers();
  }

  /* ── 날짜 포맷 ─────────────────────────────────────────────── */
  function fmtDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
  }

  /* ── 렌더 ──────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-[1400px] w-full mx-auto px-3 sm:px-6 pt-[5px] flex flex-col">

        {/* ── 헤더 (employee-manager.jsx 동일 톤) ── */}
        <div className="flex items-end justify-between border-b border-slate-200 pb-[5px] gap-2 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs font-semibold tracking-widest text-slate-500 uppercase">
              SI개발본부 · 인력운영
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 mb-[5px]">
              사용자 가입 승인 관리
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] sm:text-xs text-slate-400 hidden sm:block font-medium px-2 py-1 bg-slate-100 rounded-md">
              관리자 전용
            </span>
            <Link
              to="/"
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft size={12} />
              대시보드
            </Link>
            <button
              onClick={signOut}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 transition-colors"
            >
              <LogOut size={12} />
              로그아웃
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-2 mb-3">
          Google 계정으로 가입 요청한 사용자를 확인하고 서비스 접근 권한을 승인합니다.
        </p>

        {/* ── 통계 카드 ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <StatCard
            icon={<Users size={18} className="text-slate-600" />}
            label="전체 요청" value={stats.total} accent="bg-slate-100"
          />
          <StatCard
            icon={<Clock size={18} className="text-amber-600" />}
            label="승인 대기" value={stats.pending} accent="bg-amber-50"
          />
          <StatCard
            icon={<CheckCircle size={18} className="text-emerald-600" />}
            label="승인 완료" value={stats.approved} accent="bg-emerald-50"
          />
          <StatCard
            icon={<XCircle size={18} className="text-red-500" />}
            label="반려" value={stats.rejected} accent="bg-red-50"
          />
        </div>

        {/* ── 검색 / 필터 ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 또는 이메일 검색"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="all">전체 상태</option>
            <option value="pending">승인 대기</option>
            <option value="approved">승인 완료</option>
            <option value="rejected">반려</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="all">전체 기간</option>
            <option value="7">최근 7일</option>
            <option value="30">최근 30일</option>
          </select>
        </div>

        {/* ── 테이블 ── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400 gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
              <span className="text-sm">불러오는 중…</span>
            </div>
          ) : fetchError ? (
            <div className="flex items-center gap-2 text-red-600 py-10 justify-center text-sm">
              <AlertCircle size={16} />
              {fetchError}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-slate-400 text-sm">
              해당하는 사용자가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 w-16">상태</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">사용자</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden sm:table-cell">이메일</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden md:table-cell w-20">요청일</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden md:table-cell w-20">처리일</th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3 w-36">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <StatusBadge status={u.approval_status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar user={u} />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate">
                              {u.full_name ?? "(이름 없음)"}
                            </p>
                            <p className="text-xs text-slate-400 sm:hidden truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell truncate max-w-[200px]">
                        {u.email}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                        {fmtDate(u.requested_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                        {u.approval_status === "approved" ? fmtDate(u.approved_at) :
                         u.approval_status === "rejected" ? fmtDate(u.rejected_at) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.approval_status === "pending" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(u.id)}
                              disabled={actionBusy === u.id}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-500 text-white rounded-md hover:bg-emerald-600 font-semibold transition-colors disabled:opacity-50"
                            >
                              <UserCheck size={12} />
                              승인
                            </button>
                            <button
                              onClick={() => setRejectTarget(u)}
                              disabled={actionBusy === u.id}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50 font-semibold transition-colors disabled:opacity-50"
                            >
                              <UserX size={12} />
                              반려
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {u.approval_status === "rejected" && u.rejected_reason ? (
                              <span
                                title={u.rejected_reason}
                                className="cursor-help border-b border-dotted border-slate-300"
                              >
                                사유 있음
                              </span>
                            ) : "처리 완료"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── 반려 모달 ── */}
      {rejectTarget && (
        <RejectModal
          target={rejectTarget}
          onConfirm={handleReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
