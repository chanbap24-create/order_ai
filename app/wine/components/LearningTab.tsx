"use client";

import LearnedAliasList from "@/app/components/LearnedAliasList";
import LearnedClientList from "@/app/components/LearnedClientList";
import LearnedNewItemsList from "@/app/components/LearnedNewItemsList";
import { WINE_COLORS } from "../constants";

type Props = {
  showLearnedClients: boolean;
  setShowLearnedClients: (v: boolean | ((v: boolean) => boolean)) => void;
  learnedClientVersion: number;
  showLearned: boolean;
  setShowLearned: (v: boolean | ((v: boolean) => boolean)) => void;
  learnedVersion: number;
  onLearnedVersionBump: () => void;
  showLearnedNewItems: boolean;
  setShowLearnedNewItems: (v: boolean | ((v: boolean) => boolean)) => void;
  learnedNewItemsVersion: number;
};

/** 학습 관리 탭 — 거래처 + 별칭 + 신규 품목 3개 섹션 */
export function LearningTab({
  showLearnedClients,
  setShowLearnedClients,
  learnedClientVersion,
  showLearned,
  setShowLearned,
  learnedVersion,
  onLearnedVersionBump,
  showLearnedNewItems,
  setShowLearnedNewItems,
  learnedNewItemsVersion,
}: Props) {
  return (
    <>
      <Section
        label="학습된 거래처"
        open={showLearnedClients}
        toggle={() => setShowLearnedClients((v: boolean) => !v)}
      >
        <LearnedClientList type="wine" version={learnedClientVersion} />
      </Section>

      <Section
        label="학습된 별칭"
        open={showLearned}
        toggle={() => setShowLearned((v: boolean) => !v)}
      >
        <LearnedAliasList version={learnedVersion} onChanged={onLearnedVersionBump} />
      </Section>

      <Section
        label="학습된 신규 품목"
        open={showLearnedNewItems}
        toggle={() => setShowLearnedNewItems((v: boolean) => !v)}
      >
        <LearnedNewItemsList version={learnedNewItemsVersion} />
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
          background: WINE_COLORS.surfaceBgAlt,
          border: `1px solid ${WINE_COLORS.dividerCardLight}`,
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
            background: WINE_COLORS.surfaceBgAlt,
            borderRadius: 12,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
