'use client';

import { Section } from '@/app/components/ui';
import { selectStyle, btnPrimary, btnSecondary, btnDisabled } from '@/app/styles/controls';

type Props = {
  isAdmin: boolean;
  currentManager: string;
  managers: string[];
  selectedManager: string;
  onSelectManager: (v: string) => void;
  scanning: boolean;
  onScan: () => void;
  lastScanned: string | null;
  onShowDismissed: () => void;
};

export function ScanHeader(p: Props) {
  const scanDisabled = !p.selectedManager || p.scanning;
  const lastScanLabel = p.lastScanned
    ? new Date(p.lastScanned).toLocaleString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Section padding="sm">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* 담당자 — admin 은 select, user 는 inline pill */}
        {p.isAdmin ? (
          <select
            value={p.selectedManager}
            onChange={(e) => p.onSelectManager(e.target.value)}
            style={{ ...selectStyle, width: 160 }}
          >
            <option value="">담당자 선택</option>
            {p.managers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <span
            style={{
              height: 34,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 12px',
              borderRadius: 6,
              background: 'var(--surface-muted)',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--text-tertiary)' }}>담당자</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {p.currentManager}
            </span>
          </span>
        )}

        <button
          onClick={p.onScan}
          disabled={scanDisabled}
          style={scanDisabled ? btnDisabled(btnPrimary) : btnPrimary}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={p.scanning ? { animation: 'spin 1s linear infinite' } : {}}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          {p.scanning ? '스캔 중...' : '재고 스캔'}
        </button>

        {lastScanLabel && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            마지막 {lastScanLabel}
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button onClick={p.onShowDismissed} style={btnSecondary}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          제외 관리
        </button>
      </div>
    </Section>
  );
}
