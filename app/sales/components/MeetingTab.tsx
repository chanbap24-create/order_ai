'use client';
import { ListSkeleton } from '@/app/components/ui';
import { useLoadGate } from '@/app/components/ui/LoadGate';

import { useEffect, useState } from 'react';
import type { ImportScheduleItem } from '@/app/types/wine';
import type { Meeting } from '../meeting/types';
import { useMeetings } from '../meeting/hooks/useMeetings';
import { useCollectionMarkers } from '../meeting/hooks/useCollectionMarkers';
import { useMeetingModal } from '../meeting/hooks/useMeetingModal';
import { useMeetingDetail } from '../meeting/hooks/useMeetingDetail';
import { useReminders } from '../meeting/hooks/useReminders';
import { useQuoteColumns } from '../meeting/hooks/useQuoteColumns';
import { formatDate } from '../meeting/lib/format';
import { MeetingHeader } from '../meeting/components/MeetingHeader';
import { MonthCalendar } from '../meeting/components/MonthCalendar';
import { WeekList } from '../meeting/components/WeekList';
import { ImportSidebar } from '../meeting/components/ImportSidebar';
import { ImportMobilePanel } from '../meeting/components/ImportMobilePanel';
import { ImportDetailModal } from '../meeting/components/ImportDetailModal';
import { MeetingModal } from '../meeting/components/MeetingModal';
import { MeetingDetailPanel } from '../meeting/components/MeetingDetailPanel';
import { ToastBar } from '../meeting/components/ToastBar';
import { Stack } from '@/app/components/ui';

type Props = {
  currentManager: string;
  isAdmin: boolean;
  /** page.tsx에서 이미 로드한 managers. 있으면 중복 fetch 방지. */
  initialManagers?: string[];
};

export default function MeetingTab({ currentManager, isAdmin, initialManagers }: Props) {
  const [toast, setToast] = useState('');
  const [pendingCalUrl, setPendingCalUrl] = useState('');
  const [importDetailDate, setImportDetailDate] = useState<string | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);

  const data = useMeetings({ isAdmin, currentManager, initialManagers });
  useLoadGate('tab-meetings', data.loading);
  const { quoteCols, setQuoteCols } = useQuoteColumns();

  const detail = useMeetingDetail({
    loadMeetings: data.loadMeetings,
    setToast,
  });

  const { reminderToast, setReminderToast, requestPermissionNow } = useReminders(
    data.meetings,
    detail.openDetail,
  );

  const modal = useMeetingModal({
    currentManager,
    filterManager: data.filterManager,
    loadMeetings: data.loadMeetings,
    setToast,
    setPendingCalUrl,
    onFirstSave: requestPermissionNow,
  });

  // ── 토스트 자동 소멸 ──
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(
      () => {
        setToast('');
        setPendingCalUrl('');
      },
      pendingCalUrl ? 8000 : 3000,
    );
    return () => clearTimeout(t);
  }, [toast, pendingCalUrl]);

  // ── 파생 데이터: 날짜 배열, 날짜별 그룹 ──
  const rangeDates: string[] = [];
  const dayCount = Math.round((data.weekEnd.getTime() - data.weekStart.getTime()) / 86400000) + 1;
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(data.weekStart);
    d.setDate(data.weekStart.getDate() + i);
    rangeDates.push(formatDate(d));
  }

  const meetingsByDate: Record<string, Meeting[]> = {};
  for (const d of rangeDates) meetingsByDate[d] = [];
  for (const m of data.meetings) {
    const d = m.meeting_date?.slice(0, 10);
    if (meetingsByDate[d]) meetingsByDate[d].push(m);
  }

  const weekGroups: string[][] = [];
  if (data.viewMode === 'month') {
    let cur: string[] = [];
    for (const s of rangeDates) {
      const d = new Date(s + 'T00:00:00');
      if (cur.length > 0 && d.getDay() === 0) {
        weekGroups.push(cur);
        cur = [];
      }
      cur.push(s);
    }
    if (cur.length > 0) weekGroups.push(cur);
  }

  const importByDate: Record<string, { brands: string[]; items: ImportScheduleItem[] }> = {};
  for (const item of data.importItems) {
    const d = item.arrival_date?.slice(0, 10);
    if (!d) continue;
    if (!importByDate[d]) importByDate[d] = { brands: [], items: [] };
    importByDate[d].items.push(item);
    if (item.brand_code && !importByDate[d].brands.includes(item.brand_code)) {
      importByDate[d].brands.push(item.brand_code);
    }
  }
  const importDates = Object.keys(importByDate).sort();

  // 수금 마커(수금약속일/특별관리) — 현재 보이는 기간
  const collectionByDate = useCollectionMarkers(
    data.filterManager,
    formatDate(data.weekStart),
    formatDate(data.weekEnd),
  );

  const todayStr = formatDate(new Date());
  const rangeLabel =
    data.viewMode === 'week'
      ? `${data.weekStart.getMonth() + 1}/${data.weekStart.getDate()} ~ ${data.weekEnd.getMonth() + 1}/${data.weekEnd.getDate()}`
      : `${data.weekBase.getFullYear()}년 ${data.weekBase.getMonth() + 1}월`;

  return (
    <Stack direction="vertical" gap={16} style={{ paddingBottom: 80 }}>
      <MeetingHeader
        viewMode={data.viewMode}
        setViewMode={data.setViewMode}
        isAdmin={isAdmin}
        managers={data.managers}
        filterManager={data.filterManager}
        setFilterManager={data.setFilterManager}
        rangeLabel={rangeLabel}
        weekStart={data.weekStart}
        prevPeriod={data.prevPeriod}
        nextPeriod={data.nextPeriod}
        goToday={data.goToday}
      />

      {data.loading ? (
        <ListSkeleton rows={6} />
      ) : data.viewMode === 'month' ? (
        <div style={{ display: 'flex', gap: 12 }}>
          <MonthCalendar
            weekGroups={weekGroups}
            meetings={data.meetings}
            meetingsByDate={meetingsByDate}
            importByDate={importByDate}
            collectionByDate={collectionByDate}
            holidays={data.holidays}
            todayStr={todayStr}
            onCreateMeeting={modal.openCreateModal}
            onOpenMeeting={detail.openDetail}
            onOpenImport={setImportDetailDate}
          />
          <ImportSidebar
            importDates={importDates}
            importByDate={importByDate}
            onOpenDate={setImportDetailDate}
          />
        </div>
      ) : (
        <WeekList
          rangeDates={rangeDates}
          meetingsByDate={meetingsByDate}
          holidays={data.holidays}
          todayStr={todayStr}
          onCreateMeeting={modal.openCreateModal}
          onOpenMeeting={detail.openDetail}
        />
      )}

      {importDates.length > 0 && data.viewMode === 'month' && (
        <button
          className="import-fab-mobile"
          onClick={() => setShowImportPanel(true)}
          style={{
            position: 'fixed', bottom: 90, right: 16, zIndex: 900,
            width: 48, height: 48, borderRadius: '50%', border: 'none',
            background: 'var(--status-warning)', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 3px 12px rgba(230,81,0,0.4)',
            display: 'none', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', lineHeight: 1.1,
          }}
        >
          <span style={{ fontSize: 14 }}>入</span>
          <span style={{ fontSize: 9 }}>{importDates.length}</span>
        </button>
      )}

      <ImportMobilePanel
        visible={showImportPanel}
        importDates={importDates}
        importByDate={importByDate}
        onClose={() => setShowImportPanel(false)}
        onOpenDate={(d) => {
          setImportDetailDate(d);
          setShowImportPanel(false);
        }}
      />

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (max-width: 768px) {
          .import-sidebar-desktop { display: none !important; }
          .import-fab-mobile { display: flex !important; }
        }
        @media (min-width: 769px) {
          .import-fab-mobile { display: none !important; }
        }
      `}</style>

      <MeetingModal modal={modal} currentManager={currentManager} />

      <MeetingDetailPanel
        detail={detail}
        onEdit={(m) => {
          detail.closeDetail();
          modal.openEditModal(m);
        }}
        onDelete={async (id) => {
          await modal.deleteMeeting(id);
          if (detail.detailMeeting?.id === id) detail.closeDetail();
        }}
        quoteCols={quoteCols}
        setQuoteCols={setQuoteCols}
        onNotesSaved={() => {
          setToast('메모가 저장되었습니다.');
          data.loadMeetings();
        }}
      />

      <ImportDetailModal
        date={importDetailDate}
        items={importDetailDate ? importByDate[importDetailDate]?.items || [] : []}
        brands={importDetailDate ? importByDate[importDetailDate]?.brands || [] : []}
        onClose={() => setImportDetailDate(null)}
      />

      <ToastBar
        toast={toast}
        pendingCalUrl={pendingCalUrl}
        hasReminderToast={!!reminderToast}
        onClearPending={() => {
          setPendingCalUrl('');
          setToast('');
        }}
        reminderToast={reminderToast}
        onReminderClick={() => {
          if (!reminderToast) return;
          const m = data.meetings.find((mt) => mt.id === reminderToast.meetingId);
          if (m) detail.openDetail(m);
          setReminderToast(null);
        }}
        onReminderDismiss={() => setReminderToast(null)}
      />
    </Stack>
  );
}
