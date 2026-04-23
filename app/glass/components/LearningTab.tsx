"use client";

import LearnedAliasList from "@/app/components/LearnedAliasList";
import LearnedClientList from "@/app/components/LearnedClientList";
import { GLASS_COLORS } from "../constants";

type Props = {
  showLearnedClients: boolean;
  setShowLearnedClients: (v: boolean | ((v: boolean) => boolean)) => void;
  learnedClientVersion: number;
  showLearned: boolean;
  setShowLearned: (v: boolean | ((v: boolean) => boolean)) => void;
  learnedVersion: number;
  onLearnedVersionBump: () => void;
};

/**
 * 학습 관리 탭 — 학습된 거래처 목록 + 학습목록을 접기/펼치기로 제공.
 */
export function LearningTab({
  showLearnedClients,
  setShowLearnedClients,
  learnedClientVersion,
  showLearned,
  setShowLearned,
  learnedVersion,
  onLearnedVersionBump,
}: Props) {
  return (
    <>
      <Section
        label="학습된 거래처"
        open={showLearnedClients}
        toggle={() => setShowLearnedClients((v: boolean) => !v)}
      >
        <LearnedClientList type="glass" version={learnedClientVersion} />
      </Section>

      <Section
        label="학습목록"
        open={showLearned}
        toggle={() => setShowLearned((v: boolean) => !v)}
      >
        <LearnedAliasList version={learnedVersion} onChanged={onLearnedVersionBump} />
      </Section>
    </>
  );
}

function Section({
  label,
  open,
  toggle,
  children,
}: {
  label: string;
  open: boolean;
  toggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={toggle}
        style={{
          width: "100%",
          padding: 12,
          background: GLASS_COLORS.surfaceBgAlt,
          border: `1px solid ${GLASS_COLORS.dividerCardLight}`,
          borderRadius: 12,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span>{label}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            padding: 16,
            background: GLASS_COLORS.surfaceBgAlt,
            borderRadius: 12,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
