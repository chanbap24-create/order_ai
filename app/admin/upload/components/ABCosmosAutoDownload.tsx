"use client";

import Card from "@/app/components/ui/Card";
import type { UploadMode } from "../types";
import { useABCosmosSync } from "../hooks/useABCosmosSync";
import { SyncLogViewer } from "./SyncLogViewer";
import { RemoteSyncButton } from "./RemoteSyncButton";

type Props = {
  handleUpload: (type: string, file: File, mode?: UploadMode) => Promise<void>;
  checkStatus: () => void;
};

export function ABCosmosAutoDownload({ handleUpload, checkStatus }: Props) {
  const s = useABCosmosSync({ handleUpload, checkStatus });

  return (
    <Card style={{ marginBottom: "var(--space-6)", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-md)",
              background: "var(--surface-dark)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: 0 }}>
              ERP 데이터 동기화
            </h3>
            <p
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-light)",
                margin: 0,
              }}
            >
              ABCosmos ERP에서 6개 파일 다운로드 + DB 자동 반영
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
          <button
            onClick={() => s.startDownloadOnly("all")}
            disabled={s.isBusy}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              background: s.isBusy ? "var(--color-border)" : "white",
              color: s.isBusy ? "var(--color-text-lighter)" : "var(--color-text)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: s.isBusy ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            다운로드만
          </button>
          <button
            onClick={() => s.startSync("all")}
            disabled={s.isBusy}
            style={{
              padding: "8px 20px",
              borderRadius: "var(--radius-md)",
              background: s.isBusy
                ? "var(--color-border)"
                : "var(--surface-dark)",
              color: "white",
              border: "none",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              cursor: s.isBusy ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: s.isBusy ? "none" : "0 2px 8px rgba(124,58,237,0.3)",
            }}
          >
            {s.isBusy ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }}
                />{" "}
                {s.phaseLabel}
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                </svg>{" "}
                일괄 동기화
              </>
            )}
          </button>
          <RemoteSyncButton />
        </div>
      </div>

      <SyncLogViewer
        logs={s.logs}
        logRef={s.logRef}
        isBusy={s.isBusy}
        phaseLabel={s.phaseLabel}
        phase={s.phase}
        successCount={s.successCount}
        failCount={s.failCount}
        expanded={s.expanded}
        setExpanded={s.setExpanded}
      />
    </Card>
  );
}
