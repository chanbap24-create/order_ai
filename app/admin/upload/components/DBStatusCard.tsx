"use client";

import Card from "@/app/components/ui/Card";
import { UPLOAD_LABELS } from "../constants";
import { formatTimestamp } from "../lib/format";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statusResult: any;
  statusError: string;
  isChecking: boolean;
  onRefresh: () => void;
};

export function DBStatusCard({ statusResult, statusError, isChecking, onRefresh }: Props) {
  return (
    <Card style={{ marginBottom: "var(--space-6)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-4)",
        }}
      >
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>DB 상태</h2>
        <button className="btn btn-outline btn-sm" onClick={onRefresh} disabled={isChecking}>
          {isChecking ? "확인 중..." : "상태 확인"}
        </button>
      </div>

      {statusError && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            background: "rgba(255,59,48,0.08)",
            border: "1px solid rgba(255,59,48,0.2)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-error)",
            fontSize: "var(--text-sm)",
          }}
        >
          {statusError}
        </div>
      )}

      {statusResult?.stats && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-3)",
            }}
          >
            <StatPill label="CDV (와인)" value={`${(statusResult.stats?.cdv_items || 0).toLocaleString()}개`} />
            <StatPill label="DL (글라스)" value={`${(statusResult.stats?.dl_items || 0).toLocaleString()}개`} />
          </div>

          {statusResult.uploadTimestamps && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "var(--space-2)",
              }}
            >
              {Object.entries(statusResult.uploadTimestamps as Record<string, string | null>).map(
                ([type, ts]) => (
                  <div
                    key={type}
                    style={{
                      padding: "var(--space-2) var(--space-4)",
                      background: "var(--color-background)",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    <span style={{ color: "var(--color-text-light)", fontWeight: 600 }}>
                      {UPLOAD_LABELS[type] || type}
                    </span>
                    <span
                      style={{
                        fontWeight: 500,
                        color: ts ? "var(--color-text)" : "var(--color-text-lighter)",
                        fontSize: "var(--text-xs)",
                      }}
                    >
                      {formatTimestamp(ts as string | null)}
                    </span>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {!statusResult && !statusError && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-lighter)" }}>
          상태 확인 버튼을 눌러 현재 DB 상태를 조회합니다.
        </p>
      )}
    </Card>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "var(--space-3) var(--space-4)",
        background: "var(--color-background)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <span style={{ color: "var(--color-text-light)" }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
