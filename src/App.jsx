import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import LoginPage from "./LoginPage.jsx";
import EmployeeManager from "./employee-manager.jsx";
import ApprovalPendingPage from "./pages/ApprovalPendingPage.jsx";
import ApprovalRejectedPage from "./pages/ApprovalRejectedPage.jsx";
import UserApprovalsPage from "./pages/admin/UserApprovalsPage.jsx";

/* approval_status → 이동할 경로 */
function NavigateByStatus({ status }) {
  if (status === "pending")  return <Navigate to="/approval-pending"  replace />;
  if (status === "rejected") return <Navigate to="/approval-rejected" replace />;
  return <Navigate to="/" replace />;
}

/* 로딩 스플래시 */
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
        <span className="text-sm text-slate-500">로딩 중…</span>
      </div>
    </div>
  );
}

/* 인증 + 승인 상태 기반 라우팅 */
function AppRoutes() {
  const { session, profile, loading } = useAuth();

  if (loading) return <LoadingSpinner />;

  /* 미로그인 */
  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*"      element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const status  = profile?.approval_status ?? "pending";
  const isAdmin = profile?.role === "admin" && status === "approved";

  return (
    <Routes>
      {/* 로그인 상태에서 /login 접근 → 상태에 따라 이동 */}
      <Route path="/login" element={<NavigateByStatus status={status} />} />

      {/* 승인 대기 화면 — pending 사용자만 */}
      <Route path="/approval-pending" element={
        status === "pending"
          ? <ApprovalPendingPage />
          : <NavigateByStatus status={status} />
      } />

      {/* 반려 안내 화면 — rejected 사용자만 */}
      <Route path="/approval-rejected" element={
        status === "rejected"
          ? <ApprovalRejectedPage />
          : <NavigateByStatus status={status} />
      } />

      {/* 관리자 가입 승인 관리 — admin + approved만 */}
      <Route path="/admin/user-approvals" element={
        isAdmin
          ? <UserApprovalsPage />
          : <NavigateByStatus status={status} />
      } />

      {/* 메인 대시보드 — approved만 */}
      <Route path="*" element={
        status === "approved"
          ? <EmployeeManager />
          : <NavigateByStatus status={status} />
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
