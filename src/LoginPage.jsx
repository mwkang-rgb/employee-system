/**
 * LoginPage.jsx
 *
 * 로그인 화면.
 * - 이메일/비밀번호 로그인 + 회원가입 토글
 * - 구글 OAuth 로그인
 * - 기존 앱의 indigo + slate 디자인 시스템 일치
 *
 * 사용: AuthProvider가 session === null일 때 이 컴포넌트를 렌더
 */

import { useState } from "react";
import { Mail, Lock, LogIn, UserPlus, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";

export default function LoginPage() {
  const { signInEmail, signUpEmail, signInGoogle, authError, clearError, loading } = useAuth();

  const [mode, setMode] = useState("login");          // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [signupDone, setSignupDone] = useState(false); // 회원가입 완료 안내

  const isLogin = mode === "login";

  /* ── 이메일 제출 ─────────────────────────────────────────── */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) return;
    clearError();
    setBusy(true);
    try {
      if (isLogin) {
        await signInEmail(email, password);
        // 성공 시 AuthContext → App.jsx 에서 자동으로 메인 화면 표시
      } else {
        const { ok } = await signUpEmail(email, password);
        if (ok) setSignupDone(true);
      }
    } finally {
      setBusy(false);
    }
  }

  /* ── 구글 OAuth ──────────────────────────────────────────── */
  async function handleGoogle() {
    clearError();
    setBusy(true);
    try {
      await signInGoogle(); // 외부 팝업 → 리다이렉트 방식이므로 별도 처리 불필요
    } finally {
      setBusy(false);
    }
  }

  /* ── 회원가입 완료 안내 화면 ─────────────────────────────── */
  if (signupDone) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
            <Mail size={28} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">이메일을 확인하세요</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            <span className="font-medium text-slate-700">{email}</span>으로<br />
            인증 링크를 발송했습니다.<br />
            링크를 클릭하면 로그인이 완료됩니다.
          </p>
          <button
            onClick={() => { setSignupDone(false); setMode("login"); }}
            className="w-full px-4 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
          >
            로그인 화면으로
          </button>
        </div>
      </div>
    );
  }

  /* ── 메인 로그인 UI ──────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50/40 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 영역 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white">
              <rect x="3" y="4" width="7" height="9" rx="1.5" fill="currentColor" opacity=".9" />
              <rect x="14" y="4" width="7" height="5" rx="1.5" fill="currentColor" opacity=".6" />
              <rect x="14" y="13" width="7" height="7" rx="1.5" fill="currentColor" opacity=".75" />
              <rect x="3" y="17" width="7" height="3" rx="1.5" fill="currentColor" opacity=".5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">인력 운영 시스템</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isLogin ? "계속하려면 로그인하세요" : "새 계정을 만드세요"}
          </p>
        </div>

        {/* 카드 */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 p-6 space-y-4">

          {/* 오류 메시지 */}
          {authError && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* 구글 로그인 */}
          <button
            onClick={handleGoogle}
            disabled={busy || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* 구글 공식 컬러 아이콘 */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google로 {isLogin ? "로그인" : "시작하기"}
          </button>

          {/* 구분선 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400 font-medium">또는</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* 이메일 폼 */}
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            {/* 이메일 */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">이메일</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                  placeholder="name@company.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">비밀번호</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  required
                  minLength={6}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                  placeholder={isLogin ? "비밀번호" : "6자 이상"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
              </div>
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={busy || !email || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isLogin ? (
                <LogIn size={16} />
              ) : (
                <UserPlus size={16} />
              )}
              {isLogin ? "로그인" : "계정 만들기"}
            </button>
          </form>
        </div>

        {/* 모드 전환 */}
        <p className="text-center text-sm text-slate-500 mt-5">
          {isLogin ? "아직 계정이 없으신가요?" : "이미 계정이 있으신가요?"}{" "}
          <button
            onClick={() => { setMode(isLogin ? "signup" : "login"); clearError(); }}
            className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
          >
            {isLogin ? "회원가입" : "로그인"}
          </button>
        </p>
      </div>
    </div>
  );
}
