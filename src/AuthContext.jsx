/**
 * AuthContext.jsx
 *
 * Supabase Auth 상태를 앱 전역에 제공하는 컨텍스트.
 *
 * 제공 값:
 *   session       — Supabase Session 객체 (null = 미로그인, undefined = 로딩 중)
 *   user          — session?.user 단축키
 *   loading       — 초기 세션 확인 중 여부
 *   signInEmail   — 이메일/비밀번호 로그인
 *   signUpEmail   — 이메일/비밀번호 회원가입
 *   signInGoogle  — 구글 OAuth 로그인 (팝업 방식)
 *   signOut       — 로그아웃
 *   authError     — 최근 auth 오류 메시지 (string | null)
 *   clearError    — authError 초기화
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = 아직 초기 세션 체크 전 (스플래시/로딩 화면 표시용)
  const [session, setSession] = useState(undefined);
  const [authError, setAuthError] = useState(null);

  /* ── 초기 세션 확인 + 변경 구독 ─────────────────────────── */
  useEffect(() => {
    // 현재 탭에 이미 세션이 있는지 즉시 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
    });

    // 로그인·로그아웃·토큰 갱신 이벤트 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* ── Auth 메서드 ─────────────────────────────────────────── */
  const signInEmail = useCallback(async (email, password) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    return !error;
  }, []);

  const signUpEmail = useCallback(async (email, password) => {
    setAuthError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
      return { ok: false };
    }
    // 이메일 확인이 필요한 경우 Supabase가 자동 처리
    return { ok: true };
  }, []);

  const signInGoogle = useCallback(async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // 로그인 완료 후 현재 페이지로 복귀
        redirectTo: window.location.origin,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (error) setAuthError(error.message);
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await supabase.auth.signOut();
  }, []);

  const clearError = useCallback(() => setAuthError(null), []);

  /* ── 값 제공 ─────────────────────────────────────────────── */
  const value = {
    session,
    user: session?.user ?? null,
    loading: session === undefined,   // 초기 체크 완료 전
    signInEmail,
    signUpEmail,
    signInGoogle,
    signOut,
    authError,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** 컴포넌트 안에서 호출: const { user, signOut } = useAuth(); */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 반드시 <AuthProvider> 안에서 사용해야 합니다.");
  return ctx;
}
