import { AlertTriangle, AlertCircle, CalendarOff, BuildingOff, MapPinOff } from "lucide-react";

const ALERT_CONFIG = {
  "투입 형태 오류":     { Icon: AlertTriangle, iconCls: "text-orange-500", bgCls: "bg-orange-100" },
  "필수 항목 누락":     { Icon: AlertCircle,   iconCls: "text-red-600",    bgCls: "bg-red-100"    },
  "날짜 입력 오류":     { Icon: AlertCircle,   iconCls: "text-orange-500", bgCls: "bg-orange-100" },
  "알림":               { Icon: AlertCircle,   iconCls: "text-orange-500", bgCls: "bg-orange-100" },
  "프로젝트 기간 필수": { Icon: CalendarOff,   iconCls: "text-amber-600",  bgCls: "bg-amber-100"  },
  "장소 필수":          { Icon: BuildingOff,   iconCls: "text-blue-600",   bgCls: "bg-blue-100"   },
  "주소 필수":          { Icon: MapPinOff,     iconCls: "text-pink-600",   bgCls: "bg-pink-100"   },
};

// props:
//   title   — 모달 제목 (ALERT_CONFIG 키 중 하나 또는 임의 문자열)
//   message — 본문 메시지
//   onClose — 확인 버튼 클릭 시 호출 (ESC/배경 클릭으로는 닫히지 않음)
export default function AlertModal({ title, message, onClose }) {
  const cfg = ALERT_CONFIG[title] ?? ALERT_CONFIG["알림"];
  const { Icon, iconCls, bgCls } = cfg;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center px-6 pt-7 pb-5 gap-3">
          <div className={`w-14 h-14 rounded-full ${bgCls} flex items-center justify-center`}>
            <Icon size={26} className={iconCls} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="text-center text-sm text-slate-600 whitespace-pre-wrap">{message}</p>
        </div>
        <div className="border-t border-slate-200">
          <button
            autoFocus
            onClick={onClose}
            className="w-full py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
