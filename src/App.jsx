/**
 * App.jsx (수정본)
 *
 * 변경 내용:
 *   1. AuthProvider로 전체 앱 래핑
 *   2. session === undefined  → 로딩 스플래시
 *   3. session === null       → LoginPage 표시
 *   4. session 있음           → EmployeeManager (기존 메인 화면)
 *
 * ─── 변경 전 ────────────────────────────────────────────────
 *   import EmployeeManager from "./employee-manager.jsx";
 *   export default function App() {
 *     return <EmployeeManager />;
 *   }
 * ────────────────────────────────────────────────────────────
 */

import { AuthProvider, useAuth } from "./AuthContext.jsx";
import LoginPage from "./LoginPage.jsx";
import EmployeeManager from "./employee-manager.jsx";

/* ── 인증 게이트 ────────────────────────────────────────────── */
// AuthProvider 내부에서만 useAuth를 쓸 수 있어서 별도 컴포넌트로 분리
function AuthGate() {
  const { session, loading } = useAuth();

  // 초기 세션 확인 중 — 짧은 스플래시 표시
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          {/* Tailwind animate-spin */}
          <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
          <span className="text-sm text-slate-500">로딩 중…</span>
        </div>
      </div>
    );
  }

  // 미로그인 → 로그인 페이지
  if (!session) return <LoginPage />;

  // 로그인 완료 → 기존 메인 화면
  return <EmployeeManager />;
}

/* ── 루트 컴포넌트 ──────────────────────────────────────────── */
export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
