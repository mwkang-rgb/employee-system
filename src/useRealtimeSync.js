/**
 * useRealtimeSync.js
 *
 * Supabase Realtime 채널을 구독해 직원·프로젝트 테이블 변경을
 * 자동으로 로컬 state에 반영하는 커스텀 훅.
 *
 * ── 사용 방법 (employee-manager.jsx 안) ──────────────────────
 *
 *   import { useRealtimeSync } from "./useRealtimeSync.js";
 *
 *   // employees, projects state가 이미 있다고 가정
 *   useRealtimeSync({ setEmployees, setProjects });
 *
 * ─────────────────────────────────────────────────────────────
 *
 * Supabase 테이블 설정 전제 조건:
 *   employees 테이블 — Realtime enabled
 *   projects  테이블 — Realtime enabled  (선택)
 *
 * 활성화 방법:
 *   Supabase Dashboard → Database → Replication
 *   → supabase_realtime publication에 employees / projects 추가
 */

import { useEffect, useRef } from "react";
import { supabase } from "./supabaseClient.js";

function rawToApp(row) {
  if (!row) return row;
  return {
    ...row,
    projectId: row.project_id == null ? "pool" : row.project_id,
    startDate: row.start_date ?? row.startDate,
    endDate: row.end_date ?? row.endDate,
    partnerName: row.partner_name ?? row.partnerName,
    pooledAt: row.pooled_at ?? row.pooledAt,
    assignmentType: row.assignment_type ?? row.assignmentType,
    residencyType: row.residency_type ?? row.residencyType ?? "상주",
  };
}

/**
 * @param {Object}   opts
 * @param {Function} opts.setEmployees — (updater: prev => next) 형태의 state setter
 * @param {Function} [opts.setProjects] — 프로젝트 목록도 동기화할 경우 전달
 * @param {boolean}  [opts.enabled=true] — false로 전달하면 구독 안 함 (비로그인 등)
 */
export function useRealtimeSync({ setEmployees, setProjects, enabled = true }) {
  // 채널 ref (cleanup용)
  const channelRef = useRef(null);

  useEffect(() => {
    // supabase 클라이언트가 없거나 비활성 상태면 skip
    if (!enabled || !supabase) return;

    /* ── 채널 생성 ─────────────────────────────────────────── */
    const channel = supabase
      .channel("db-changes")  // 채널 이름 — 앱 내 유일해야 함

      /* ── employees 변경 ─────────────────────────────── */
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "employees" },
        (payload) => {
          const newEmp = rawToApp(payload.new);
          setEmployees((prev) => {
            // 이미 존재하면(낙관적 업데이트 등) 교체, 없으면 추가
            const exists = prev.some((e) => e.id === newEmp.id);
            return exists
              ? prev.map((e) => (e.id === newEmp.id ? newEmp : e))
              : [...prev, newEmp];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "employees" },
        (payload) => {
          const updated = rawToApp(payload.new);
          setEmployees((prev) =>
            prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "employees" },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId == null) return;
          setEmployees((prev) => prev.filter((e) => e.id !== deletedId));
        }
      );

    /* ── projects 변경 (선택) ───────────────────────────── */
    if (setProjects) {
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "projects" },
          (payload) => {
            const newProj = payload.new;
            setProjects((prev) => {
              const exists = prev.some((p) => p.id === newProj.id);
              return exists ? prev : [...prev, newProj];
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "projects" },
          (payload) => {
            const updated = payload.new;
            setProjects((prev) =>
              prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
            );
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "projects" },
          (payload) => {
            const deletedId = payload.old?.id;
            if (deletedId == null) return;
            setProjects((prev) => prev.filter((p) => p.id !== deletedId));
          }
        );
    }

    /* ── 구독 시작 ─────────────────────────────────────────── */
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[Realtime] 구독 연결됨 ✓");
      }
      if (status === "CHANNEL_ERROR") {
        console.warn("[Realtime] 채널 오류 — 재연결 시도 중…");
      }
      if (status === "TIMED_OUT") {
        console.warn("[Realtime] 연결 타임아웃 — 재연결 시도 중…");
      }
    });

    channelRef.current = channel;

    /* ── 정리 (언마운트 또는 enabled 변경 시) ─────────────── */
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        console.log("[Realtime] 구독 해제됨");
      }
    };
  }, [enabled, setEmployees, setProjects]);
}
