'use client';

import { useEffect, useState } from 'react';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import type { DashboardStats, ChangeLogEntry } from '@/app/types/wine';

const ACTION_LABELS: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  new_wine_detected: { label: '신규 와인', variant: 'success' },
  price_changed: { label: '가격 변동', variant: 'warning' },
  wines_discontinued: { label: '단종', variant: 'error' },
  wine_updated: { label: '와인 수정', variant: 'info' },
  tasting_note_saved: { label: '테이스팅노트', variant: 'primary' },
  ai_research: { label: 'AI 조사', variant: 'info' },
  ppt_generated: { label: 'PPT 생성', variant: 'success' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

export default function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((data) => { if (data.success) setStats(data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-light)' }}>로딩 중...</div>;
  if (!stats) return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-error)' }}>데이터를 불러올 수 없습니다.</div>;

  const formatKrw = (v: number) => {
    if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(1)}억`;
    if (v >= 1_0000) return `${(v / 1_0000).toFixed(0)}만`;
    return v.toLocaleString();
  };

  const statCards = [
    { label: '전체 와인', value: stats.totalWines, color: 'var(--color-primary)' },
    { label: '신규 와인 (미처리)', value: stats.newWines, color: stats.newWines > 0 ? 'var(--color-warning)' : 'var(--color-success)' },
    { label: '재고 부족', value: stats.lowStock, color: stats.lowStock > 0 ? 'var(--color-error)' : 'var(--color-success)' },
    { label: '가격 변동 (30일)', value: stats.priceChanges, color: stats.priceChanges > 0 ? 'var(--color-warning)' : 'var(--color-text-light)' },
    { label: '테이스팅노트', value: `${stats.tastingNotesComplete}/${stats.tastingNotesTotal}`, color: 'var(--color-info)' },
  ];

  return (
    <div>
      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {statCards.map((s) => (
          <Card key={s.label} size="sm" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: s.color, marginBottom: 'var(--space-1)' }}>{s.value}</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* 총 재고금액 (공급가 기준) */}
      {(stats.cdvInventoryValue != null || stats.dlInventoryValue != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <Card size="sm" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em' }}>까브드뱅 (CDV)</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginBottom: 4 }}>보세 + 용마로지스</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#5A1515' }}>{formatKrw(stats.cdvInventoryValue || 0)}원</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginTop: 4 }}>총 재고금액 (공급가 기준)</div>
          </Card>
          <Card size="sm" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em' }}>대유라이프 (DL)</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginBottom: 4 }}>안성+GIG+GIG마케팅+GIG영업1</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#5A1515' }}>{formatKrw(stats.dlInventoryValue || 0)}원</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginTop: 4 }}>총 재고금액 (공급가 기준)</div>
          </Card>
        </div>
      )}

      {/* 최근 활동 */}
      <Card>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>최근 활동</h3>
        {stats.recentChanges.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-lighter)' }}>변경 이력이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {stats.recentChanges.map((log: ChangeLogEntry) => {
              const actionInfo = ACTION_LABELS[log.action] || { label: log.action, variant: 'outline' as const };
              let details = '';
              try {
                const d = log.details ? JSON.parse(log.details) : null;
                if (d?.item_name) details = d.item_name;
                else if (d?.count) details = `${d.count}건`;
                else if (d?.old_price && d?.new_price) details = `${d.old_price.toLocaleString()} → ${d.new_price.toLocaleString()}`;
              } catch { /* ignore */ }

              return (
                <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'var(--color-background)' }}>
                  <Badge variant={actionInfo.variant}>{actionInfo.label}</Badge>
                  <span style={{ fontSize: 'var(--text-sm)', flex: 1 }}>
                    {log.entity_id !== 'bulk' && <strong>{log.entity_id}</strong>}
                    {details && <span style={{ color: 'var(--color-text-light)', marginLeft: 'var(--space-2)' }}>{details}</span>}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
