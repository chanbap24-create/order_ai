'use client';

import { useEffect, useState, useCallback } from 'react';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import type { ChangeLogEntry } from '@/app/types/wine';

const ACTION_LABELS: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'outline' }> = {
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChangeLogTab() {
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (actionFilter) params.set('action', actionFilter);
    if (entityFilter) params.set('entityId', entityFilter);
    try {
      const res = await fetch(`/api/admin/change-logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.logs);
        setTotal(data.data.total);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, actionFilter, entityFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* 필터 */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="input"
          style={{ width: 160, padding: 'var(--space-2) var(--space-3)' }}
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
        >
          <option value="">전체 액션</option>
          {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input
          className="input"
          style={{ width: 200, padding: 'var(--space-2) var(--space-3)' }}
          placeholder="품번/엔티티 ID 검색..."
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
        />
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>총 {total}건</span>
      </div>

      {/* 로그 테이블 */}
      <Card style={{ overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-light)' }}>로딩 중...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-lighter)' }}>변경 이력이 없습니다.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={thStyle}>시간</th>
                <th style={thStyle}>액션</th>
                <th style={thStyle}>타입</th>
                <th style={thStyle}>대상</th>
                <th style={thStyle}>상세</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const actionInfo = ACTION_LABELS[log.action] || { label: log.action, variant: 'outline' as const };
                let details = '';
                try {
                  const d = log.details ? JSON.parse(log.details) : null;
                  if (d) details = Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', ');
                } catch { /* ignore */ }

                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>{formatDate(log.created_at)}</td>
                    <td style={tdStyle}><Badge variant={actionInfo.variant}>{actionInfo.label}</Badge></td>
                    <td style={tdStyle}><span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>{log.entity_type}</span></td>
                    <td style={tdStyle}><code style={{ fontSize: 'var(--text-xs)' }}>{log.entity_id}</code></td>
                    <td style={{ ...tdStyle, fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-4)', alignItems: 'center' }}>
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</button>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>{page} / {totalPages}</span>
          <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>다음</button>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: 'var(--space-3) var(--space-2)', fontWeight: 600, color: 'var(--color-text-light)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: 'var(--space-2)', verticalAlign: 'middle' };
