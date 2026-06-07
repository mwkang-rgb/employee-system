import { XCircle } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";

export default function ApprovalRejectedPage() {
  const { signOut, user, profile } = useAuth();
  const reason = profile?.rejected_reason;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-red-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white">
              <rect x="3"  y="4"  width="7" height="9" rx="1.5" fill="currentColor" opacity=".9" />
              <rect x="14" y="4"  width="7" height="5" rx="1.5" fill="currentColor" opacity=".6" />
              <rect x="14" y="13" width="7" height="7" rx="1.5" fill="currentColor" opacity=".75" />
              <rect x="3"  y="17" width="7" height="3" rx="1.5" fill="currentColor" opacity=".5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">인력 운영 시스템</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <XCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">가입 요청이 승인되지 않았습니다</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            입력하신 Google 계정은 현재 시스템 접근이 허용되지 않았습니다.<br />
            관리자에게 문의해 주세요.
          </p>
          {user?.email && (
            <p className="text-xs text-slate-400">
              요청 계정: <span className="font-medium text-slate-600">{user.email}</span>
            </p>
          )}
          {reason && (
            <div className="text-sm text-slate-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-left">
              <span className="font-semibold text-red-700">반려 사유:</span>{" "}
              <span className="text-slate-700">{reason}</span>
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 font-medium transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
