'use client';

import { useState } from 'react';
import type {
  ChurnFilter,
  ReorderFilter,
  VisitFilter,
} from '../action/types';
import { useActionData } from '../action/hooks/useActionData';
import { useDismissed } from '../action/hooks/useDismissed';
import { useRecentOrders } from '../action/hooks/useRecentOrders';
import { ActionTabHeader } from '../action/components/ActionTabHeader';
import { SummaryCards } from '../action/components/SummaryCards';
import { CompactBriefing } from '../action/components/CompactBriefing';
import { ChurnSection } from '../action/components/sections/ChurnSection';
import { ReorderSection } from '../action/components/sections/ReorderSection';
import { MeetingSection } from '../action/components/sections/MeetingSection';
import { StockSection } from '../action/components/sections/StockSection';
import { UpsellSection } from '../action/components/sections/UpsellSection';
import { NewArrivalSection } from '../action/components/sections/NewArrivalSection';
import { VisitSection } from '../action/components/sections/VisitSection';
import { SeasonSection } from '../action/components/sections/SeasonSection';

interface ActionTabProps {
  currentManager: string;
  isAdmin: boolean;
  onCountChange?: (count: number) => void;
}

export default function ActionTab({ currentManager, isAdmin, onCountChange }: ActionTabProps) {
  const data = useActionData({ currentManager, isAdmin, onCountChange });
  const { dismissed, dismissItem, clearDismissed } = useDismissed();
  const { expandedClient, recentOrders, loadingOrders, handleCardClick } = useRecentOrders();

  // UI 상태
  const [churnFilter, setChurnFilter] = useState<ChurnFilter>('all');
  const [reorderFilter, setReorderFilter] = useState<ReorderFilter>('all');
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
  const [compactMode, setCompactMode] = useState(true);
  const [churnCollapsed, setChurnCollapsed] = useState(false);
  const [reorderCollapsed, setReorderCollapsed] = useState(false);
  const [meetingCollapsed, setMeetingCollapsed] = useState(false);
  const [stockCollapsed, setStockCollapsed] = useState(false);
  const [upsellCollapsed, setUpsellCollapsed] = useState(false);
  const [newArrivalCollapsed, setNewArrivalCollapsed] = useState(false);
  const [visitCollapsed, setVisitCollapsed] = useState(false);
  const [seasonCollapsed, setSeasonCollapsed] = useState(false);

  const mgr = isAdmin ? data.selectedManager : currentManager;

  // dismissed 필터링
  const va = data.actions.filter(a => !dismissed[`churn_${a.client_code}`]);
  const vn = data.nudges.filter(n => !dismissed[`reorder_${n.client_code}_${n.item_no}`]);
  const vm = data.meetings.filter(m => !dismissed[`meeting_${m.meeting_id}`]);
  const vsd = data.stockDepletions.filter(s => !dismissed[`stock_${s.item_no}`]);
  const vu = data.upsells.filter(u => !dismissed[`upsell_${u.client_code}_${u.suggested_item_no}`]);
  const vna = data.newArrivals.filter(n => !dismissed[`arrival_${n.item_no}`]);
  const vvs = data.visitSchedules.filter(v => !dismissed[`visit_${v.client_code}`]);
  const vsr = data.seasonRecos.filter(s => !dismissed[`season_${s.item_no}`]);

  const dismissedTotal =
    (data.actions.length - va.length) +
    (data.nudges.length - vn.length) +
    (data.meetings.length - vm.length) +
    (data.stockDepletions.length - vsd.length) +
    (data.upsells.length - vu.length) +
    (data.newArrivals.length - vna.length) +
    (data.visitSchedules.length - vvs.length) +
    (data.seasonRecos.length - vsr.length);

  const filteredChurn = churnFilter === 'all' ? va : va.filter(a => a.risk_level === churnFilter);
  const filteredNudges =
    reorderFilter === 'all'
      ? vn
      : reorderFilter === 'in_stock'
        ? vn.filter(n => n.stock_status === 'in_stock' || n.stock_status === 'low_stock')
        : vn.filter(n => n.stock_status === 'out_of_stock' || n.stock_status === 'unknown');
  const filteredVisits = visitFilter === 'all' ? vvs : vvs.filter(v => v.visit_urgency === visitFilter);

  const churnCount = va.length;
  const nudgeCount = vn.length;
  const meetingCount = vm.length;
  const stockCount = vsd.length;
  const upsellCount = vu.length;
  const newArrivalCount = vna.length;
  const visitCount = vvs.length;
  const seasonCount = vsr.length;
  const hasAnyData =
    churnCount + nudgeCount + meetingCount + stockCount + upsellCount + newArrivalCount + visitCount + seasonCount > 0;
  const hasAnyRawData =
    data.actions.length + data.nudges.length + data.meetings.length + data.stockDepletions.length +
    data.upsells.length + data.newArrivals.length + data.visitSchedules.length + data.seasonRecos.length > 0;

  return (
    <div>
      <ActionTabHeader
        isAdmin={isAdmin}
        managers={data.managers}
        selectedManager={data.selectedManager}
        setSelectedManager={data.setSelectedManager}
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        scanning={data.scanning}
        currentMgr={mgr}
        onRescan={() => data.doScan(mgr)}
        lastScanned={data.lastScanned}
      />

      <SummaryCards summary={data.summary} />

      <CompactBriefing
        visible={compactMode && !!mgr && !data.scanning && hasAnyRawData}
        dismissedTotal={dismissedTotal}
        clearDismissed={clearDismissed}
        va={va}
        vn={vn}
        vm={vm}
        vsd={vsd}
        vu={vu}
        vna={vna}
        vvs={vvs}
        vsr={vsr}
        hasAnyData={hasAnyData}
        summary={data.summary}
        dismissItem={dismissItem}
        onExpandDetails={() => setCompactMode(false)}
      />

      {data.scanning && !hasAnyRawData && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          거래처를 분석하고 있습니다...
        </div>
      )}

      {!mgr && isAdmin && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          담당자를 선택해주세요.
        </div>
      )}

      {!compactMode && mgr && !data.scanning && (
        <>
          <ChurnSection
            items={va}
            filtered={filteredChurn}
            count={churnCount}
            summary={data.summary}
            churnFilter={churnFilter}
            setChurnFilter={setChurnFilter}
            collapsed={churnCollapsed}
            setCollapsed={setChurnCollapsed}
            expandedClient={expandedClient}
            recentOrders={recentOrders}
            loadingOrders={loadingOrders}
            onCardClick={handleCardClick}
            dismissItem={dismissItem}
          />

          <ReorderSection
            filtered={filteredNudges}
            count={nudgeCount}
            summary={data.summary}
            reorderFilter={reorderFilter}
            setReorderFilter={setReorderFilter}
            collapsed={reorderCollapsed}
            setCollapsed={setReorderCollapsed}
            dismissItem={dismissItem}
          />

          <MeetingSection
            items={vm}
            count={meetingCount}
            collapsed={meetingCollapsed}
            setCollapsed={setMeetingCollapsed}
            dismissItem={dismissItem}
          />

          <StockSection
            items={vsd}
            count={stockCount}
            collapsed={stockCollapsed}
            setCollapsed={setStockCollapsed}
            dismissItem={dismissItem}
          />

          <UpsellSection
            items={vu}
            count={upsellCount}
            collapsed={upsellCollapsed}
            setCollapsed={setUpsellCollapsed}
            dismissItem={dismissItem}
          />

          <NewArrivalSection
            items={vna}
            count={newArrivalCount}
            collapsed={newArrivalCollapsed}
            setCollapsed={setNewArrivalCollapsed}
            dismissItem={dismissItem}
          />

          <VisitSection
            items={vvs}
            filtered={filteredVisits}
            count={visitCount}
            visitFilter={visitFilter}
            setVisitFilter={setVisitFilter}
            collapsed={visitCollapsed}
            setCollapsed={setVisitCollapsed}
            dismissItem={dismissItem}
          />

          <SeasonSection
            items={vsr}
            rawItems={data.seasonRecos}
            count={seasonCount}
            summary={data.summary}
            collapsed={seasonCollapsed}
            setCollapsed={setSeasonCollapsed}
            dismissItem={dismissItem}
          />
        </>
      )}

      {!compactMode && !data.scanning && mgr && !hasAnyData && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          모든 거래처가 정상 상태입니다.
        </div>
      )}

      {!compactMode && dismissedTotal > 0 && (
        <div style={{ textAlign: 'center', padding: '8px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dismissedTotal}건 확인 처리됨</span>
          <button
            onClick={clearDismissed}
            style={{ fontSize: 11, color: '#8B1538', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
          >
            초기화
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
