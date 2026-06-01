'use client';

import { useEffect, useState } from 'react';
import DismissedTab from './DismissedTab';
import type { FilterType } from '../alert/types';
import { useManagers } from '../alert/hooks/useManagers';
import { useAlerts } from '../alert/hooks/useAlerts';
import { useAlternatives } from '../alert/hooks/useAlternatives';
import { useCollectionBriefing } from '../briefing/hooks/useCollectionBriefing';
import { CollectionBriefingSection } from '../briefing/components/CollectionBriefingSection';
import { ScanHeader } from '../alert/components/ScanHeader';
import { SummaryFilters } from '../alert/components/SummaryFilters';
import { AlertCard } from '../alert/components/AlertCard';
import { AlternativesPanel } from '../alert/components/AlternativesPanel';
import { Stack } from '@/app/components/ui';
import { btnSecondary } from '@/app/styles/controls';

interface AlertTabProps {
  currentManager: string;
  isAdmin: boolean;
  onCountChange?: (count: number) => void;
}

export default function AlertTab({ currentManager, isAdmin, onCountChange }: AlertTabProps) {
  const [selectedManager, setSelectedManager] = useState(isAdmin ? '' : currentManager);
  const [filter, setFilter] = useState<FilterType>('all');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const managers = useManagers(isAdmin);
  const alertsState = useAlerts({ selectedManager });
  const alt = useAlternatives();

  // 수금 연체(스캔 불필요 — 즉시 로드). 재고 알림 + 수금 연체 합산을 뱃지에 반영.
  const { data: collData } = useCollectionBriefing(selectedManager);
  const collCount = collData ? collData.counts.broken + collData.counts.overdue : 0;
  useEffect(() => {
    onCountChange?.(alertsState.counts.total + collCount);
  }, [alertsState.counts.total, collCount, onCountChange]);

  const filtered = alertsState.alerts.filter((a) => filter === 'all' || a.alert_type === filter);

  const toggleCheck = (itemNo: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemNo)) next.delete(itemNo);
      else next.add(itemNo);
      return next;
    });
  };

  const allChecked = filtered.length > 0 && filtered.every((a) => checked.has(a.item_no));
  const toggleAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(filtered.map((a) => a.item_no)));
  };

  const handleScan = async () => {
    setChecked(new Set());
    alt.setAltItemNo(null);
    setExpandedItem(null);
    await alertsState.handleScan();
  };

  const handleDismiss = async () => {
    const ok = await alertsState.handleDismiss(checked);
    if (ok) setChecked(new Set());
  };

  if (showDismissed) {
    return (
      <Stack direction="vertical" gap={16}>
        <button
          onClick={() => setShowDismissed(false)}
          style={{ ...btnSecondary, alignSelf: 'flex-start' }}
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
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          알림으로 돌아가기
        </button>
        <DismissedTab />
      </Stack>
    );
  }

  return (
    <Stack direction="vertical" gap={16}>
      <ScanHeader
        isAdmin={isAdmin}
        currentManager={currentManager}
        managers={managers}
        selectedManager={selectedManager}
        onSelectManager={setSelectedManager}
        scanning={alertsState.scanning}
        onScan={handleScan}
        lastScanned={alertsState.lastScanned}
        onShowDismissed={() => setShowDismissed(true)}
      />

      {collData && <CollectionBriefingSection data={collData} />}

      {!selectedManager && (
        <EmptyState message="담당자를 선택하면 해당 거래처의 재고 부족 와인을 확인합니다." />
      )}

      {selectedManager && alertsState.alerts.length > 0 && (
        <>
          <SummaryFilters
            counts={alertsState.counts}
            filter={filter}
            onFilterChange={setFilter}
            allChecked={allChecked}
            onToggleAll={toggleAll}
            checkedCount={checked.size}
            onDismiss={handleDismiss}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((alert) => (
              <AlertCard
                key={alert.item_no}
                alert={alert}
                isChecked={checked.has(alert.item_no)}
                onToggleCheck={() => toggleCheck(alert.item_no)}
                isExpanded={expandedItem === alert.item_no}
                onToggleExpand={() =>
                  setExpandedItem(expandedItem === alert.item_no ? null : alert.item_no)
                }
                isAltOpen={alt.altItemNo === alert.item_no}
                onToggleAlt={() => alt.openAlternatives(alert.item_no)}
                altPanel={
                  <AlternativesPanel
                    alternatives={alt.alternatives}
                    altLoading={alt.altLoading}
                    altSelected={alt.altSelected}
                    onToggleAlt={alt.toggleAlt}
                    quoteLoading={alt.quoteLoading}
                    quoteMsg={alt.quoteMsg}
                    onAddToQuote={alt.addToQuote}
                  />
                }
              />
            ))}
          </div>
        </>
      )}

      {selectedManager &&
        !alertsState.scanning &&
        alertsState.lastScanned &&
        alertsState.alerts.length === 0 && (
          <EmptyState message="재고 부족 품목이 없습니다." />
        )}

      {alertsState.scanning && <EmptyState message="재고를 스캔하는 중..." />}

      {alertsState.dismissMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background:
              alertsState.dismissMsg.includes('실패') || alertsState.dismissMsg.includes('오류')
                ? '#dc3545'
                : alertsState.dismissMsg.includes('자동 복원')
                  ? '#1565c0'
                  : '#2e7d32',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.16)',
          }}
        >
          {alertsState.dismissMsg}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Stack>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: 'var(--text-muted)',
        fontSize: 13,
        background: 'var(--surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
      }}
    >
      {message}
    </div>
  );
}
