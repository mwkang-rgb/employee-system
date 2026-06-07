/**
 * AuthContext.jsx
 *
 * Supabase Auth 상태를 앱 전역에 제공하는 컨텍스트.
 *
 * 제공 값:
 *   session       — Supabase Session 객체 (null = 미로그인, undefined = 로딩 중)
 *   user          — session?.user 단축키
 *   profile       — public.profiles 행 (approval_status, role 포함)
 *   loading       — 초기 세션 + 프로필 확인 중 여부
 *   signInEmail   — 이메일/비밀번호 로그인
 *   signUpEmail   — 이메일/비밀번호 회원가입
 *   signInGoogle  — 구글 OAuth 로그인 (팝업 방식)
 *   signOut       — 로그아웃
 *   authError     — 최근 auth 오류 메시지 (string | null)
 *   clearError    — authError 초기화
 *   refetchProfile — 프로필 강제 재조회 (관리자 화면 등에서 사용)
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient.js";

const ERROR_MAP = {
  "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "Email not confirmed": "이메일 인증이 완료되지 않았습니다. 받은 편지함을 확인해 주세요.",
  "User already registered": "이미 가입된 이메일입니다.",
  "Password should be at least 6 characters": "비밀번호는 6자 이상이어야 합니다.",
  "Password should contain at least one character of each": "비밀번호는 영문 대소문자, 숫자, 특수문자를 각각 하나 이상 포함해야 합니다.",
  "Unable to validate email address: invalid format": "올바른 이메일 형식이 아닙니다.",
  "signup requires a valid password": "유효한 비밀번호를 입력해 주세요.",
  "Email rate limit exceeded": "잠시 후 다시 시도해 주세요.",
};

function toKoreanError(message) {
  if (!message) return message;
  for (const [en, ko] of Object.entries(ERROR_MAP)) {
    if (message.includes(en)) return ko;
  }
  if (message.toLowerCase().includes("rate limit") || message.includes("60 seconds")) {
    return "보안을 위해 잠시 후 다시 시도해 주세요.";
  }
  return message;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = 아직 초기 세션 체크 전 (스플래시/로딩 화면 표시용)
  const [session, setSession] = useState(undefined);
  // undefined = 프로필 로딩 중, null = 없음 또는 오류
  const [profile, setProfile] = useState(undefined);
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

  /* ── 프로필 조회 (세션 변경 시) ──────────────────────────── */
  // Google OAuth 신규 가입 시 트리거가 profiles를 생성하는 데
  // 짧은 지연이 있을 수 있으므로 최대 6회 재시도한다.
  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    let attempt = 0;
    const MAX_ATTEMPTS = 6;

    async function fetchProfile() {
      if (cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, approval_status, role, rejected_reason")
        .eq("id", session.user.id)
        .single();

      if (cancelled) return;
      if (!data && attempt < MAX_ATTEMPTS) {
        attempt++;
        setTimeout(fetchProfile, 800);
        return;
      }
      setProfile(data ?? null);
    }

    setProfile(undefined);
    fetchProfile();
    return () => { cancelled = true; };
  }, [session]);

  /* ── Auth 메서드 ─────────────────────────────────────────── */
  const signInEmail = useCallback(async (email, password) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(toKoreanError(error.message));
    return !error;
  }, []);

  const signUpEmail = useCallback(async (email, password) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(toKoreanError(error.message));
      return { ok: false, status: "error" };
    }
    // identities가 빈 배열이면 이미 가입된 이메일 (Supabase 보안 정책상 오류 미반환)
    // RPC 함수로 조회: anon 상태에서 RLS 우회하여 profiles 접근
    if (!data.user || data.user.identities?.length === 0) {
      const { data: rows } = await supabase
        .rpc("get_approval_status_by_email", { p_email: email });
      const profileData = rows?.[0] ?? null;
      const status = profileData?.approval_status ?? "exists";
      return { ok: false, status, reason: profileData?.rejected_reason ?? null };
    }
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
    if (error) setAuthError(toKoreanError(error.message));
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await supabase.auth.signOut();
  }, []);

  const clearError = useCallback(() => setAuthError(null), []);

  const refetchProfile = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, approval_status, role, rejected_reason")
      .eq("id", session.user.id)
      .single();
    if (data) setProfile(data);
  }, [session]);

  /* ── 값 제공 ─────────────────────────────────────────────── */
  const value = {
    session,
    user: session?.user ?? null,
    profile,
    // 세션 확인 전 또는 세션이 있는데 프로필이 아직 로딩 중이면 true
    loading: session === undefined || (session !== null && profile === undefined),
    signInEmail,
    signUpEmail,
    signInGoogle,
    signOut,
    authError,
    clearError,
    refetchProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** 컴포넌트 안에서 호출: const { user, signOut } = useAuth(); */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 반드시 <AuthProvider> 안에서 사용해야 합니다.");
  return ctx;
}
