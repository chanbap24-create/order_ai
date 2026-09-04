'use client';
import { ListSkeleton } from '@/app/components/ui';
import { useLoadGate } from '@/app/components/ui/LoadGate';

import { useState } from 'react';
import { getKstToday } from '../briefing/lib/format';
import { useToast } from '../briefing/hooks/useToast';
import { useBriefingMeetings } from '../briefing/hooks/useBriefingMeetings';
import { useCollectionBriefing } from '../briefing/hooks/useCollectionBriefing';
import { CollectionBriefingSection } from '../briefing/components/CollectionBriefingSection';
import { useTodayShipments } from '../briefing/hooks/useTodayShipments';
import { useQuoteCols } from '../briefing/hooks/useQuoteCols';
import { useQuoteExport } from '../briefing/hooks/useQuoteExport';
import { ShipmentSection } from '../briefing/components/ShipmentSection';
import { BriefingHeader } from '../briefing/components/BriefingHeader';
import { BriefingToast, EmptyState } from '../briefing/components/EmptyState';
import { MeetingCard } from '../briefing/components/MeetingCard';
import { TodayStrip } from '../briefing/components/TodayStrip';
import { useArrivals } from '../briefing/hooks/useArrivals';
import { ArrivalsSection } from '../briefing/components/ArrivalsSection';

export default function BriefingTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  const { todayStr, todayLabel } = getKstToday();
  const { toast, setToast } = useToast();

  const { meetings, loading, generatingId, generateBriefing, generateAll } =
    useBriefingMeetings({ todayStr, currentManager, isAdmin, onToast: setToast });
  useLoadGate('tab-briefing', loading);

  const { wineShipments, glassShipments } = useTodayShipments(currentManager, isAdmin);
  const { data: collections, saveFollowup: saveCollection } = useCollectionBriefing(currentManager);
  const arrivals = useArrivals();

  const { quoteCols, toggle: toggleCol, reset: resetCols } = useQuoteCols();
  const { quoteLoadingId, createQuoteFromBriefing } =
    useQuoteExport({ quoteCols, onToast: setToast });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showColSettingsId, setShowColSettingsId] = useState<number | null>(null);
  const [expandedShipClient, setExpandedShipClient] = useState<string | null>(null);

  const pendingCount = meetings.filter(m => !m.ai_briefing && m.status !== 'cancelled').length;
  const completedCount = meetings.filter(m => !!m.ai_briefing).length;

  if (loading) {
    return <ListSkeleton rows={5} />;
  }

  const hasCollections = !!collections &&
    (collections.broken.length + collections.promiseToday.length + collections.overdue.length > 0);

  if (meetings.length === 0 && !wineShipments && !glassShipments && !hasCollections && arrivals.length === 0) {
    return <EmptyState todayLabel={todayLabel} />;
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <TodayStrip />
      <ArrivalsSection arrivals={arrivals} sender={collections?.sender} />
      {collections && <CollectionBriefingSection data={collections} onSave={saveCollection} />}

      {meetings.length > 0 && (
        <BriefingHeader
          todayLabel={todayLabel}
          totalCount={meetings.length}
          completedCount={completedCount}
          pendingCount={pendingCount}
          generating={generatingId !== null}
          onGenerateAll={generateAll}
        />
      )}

      {wineShipments && (
        <ShipmentSection
          title={`와인 출고 (${wineShipments.count}건)`}
          color="var(--action)"
          shipments={wineShipments}
          expandedShipClient={expandedShipClient}
          setExpandedShipClient={setExpandedShipClient}
          prefix="w_"
        />
      )}

      {glassShipments && (
        <ShipmentSection
          title={`글라스 출고 (${glassShipments.count}건)`}
          color="var(--status-info)"
          shipments={glassShipments}
          expandedShipClient={expandedShipClient}
          setExpandedShipClient={setExpandedShipClient}
          prefix="g_"
        />
      )}

      {meetings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {meetings.map(m => (
            <MeetingCard
              key={m.id}
              meeting={m}
              isExpanded={expandedId === m.id}
              generating={generatingId === m.id}
              onToggleExpand={() => setExpandedId(expandedId === m.id ? null : m.id)}
              onGenerate={() => {
                generateBriefing(m).then(id => { if (id != null) setExpandedId(id); });
              }}
              quoteLoading={quoteLoadingId === m.id}
              onCreateQuote={createQuoteFromBriefing}
              quoteCols={quoteCols}
              toggleCol={toggleCol}
              resetCols={resetCols}
              showColSettings={showColSettingsId === m.id}
              onToggleColSettings={() =>
                setShowColSettingsId(prev => prev === m.id ? null : m.id)
              }
              onCloseColSettings={() => setShowColSettingsId(null)}
            />
          ))}
        </div>
      )}

      <BriefingToast message={toast} />
    </div>
  );
}
