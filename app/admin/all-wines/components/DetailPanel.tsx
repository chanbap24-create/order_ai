'use client';

import { useState } from 'react';
import type { WineRowExt } from '../types';

type Props = {
  selectedWine: WineRowExt;
  editFields: Record<string, string>;
  setEditFields: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSaveField: (dbKey: string) => void;
  savingField: string;
  handleDeleteSingle: (id: string, name: string) => Promise<void>;
  deleting: boolean;
  onRefresh?: () => void;
};

export function DetailPanel(p: Props) {
  const [researching, setResearching] = useState(false);
  const [researchMsg, setResearchMsg] = useState('');
  const { selectedWine } = p;

  const handleResearch = async () => {
    const engName = p.editFields['item_name_en'] || selectedWine.item_name_en || '';
    if (!engName.trim()) {
      setResearchMsg('영문명을 먼저 입력해주세요');
      setTimeout(() => setResearchMsg(''), 3000);
      return;
    }
    setResearching(true);
    setResearchMsg('');
    try {
      const res = await fetch('/api/admin/wine-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wine_id: selectedWine.item_code,
          product_name_eng: engName.trim(),
          item_name_kr: selectedWine.item_name_kr,
          vintage: selectedWine.vintage || '',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setResearchMsg('AI 조사 완료');
        p.onRefresh?.();
        setTimeout(() => setResearchMsg(''), 4000);
      } else {
        setResearchMsg('오류: ' + (json.error || `실패 (${res.status})`));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setResearchMsg('AI 조사 요청 실패: ' + msg);
    } finally {
      setResearching(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
        {selectedWine.item_name_kr}
      </h3>

      {selectedWine.image_url && (
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <img src={selectedWine.image_url} alt="" style={{ maxHeight: 180, borderRadius: 8, border: '1px solid var(--border-default)' }} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        <DetailRow label="품번" value={selectedWine.item_code} />
        {([
          { label: '영문명', dbKey: 'item_name_en', placeholder: '영문명 입력' },
          { label: '공급자', dbKey: 'supplier', placeholder: '공급자명(영문) 입력' },
          { label: '국가', dbKey: 'country_en', placeholder: '국가(영문) 입력' },
          { label: '산지', dbKey: 'region', placeholder: '지역 입력' },
          { label: '품종', dbKey: 'grape_varieties', placeholder: '예: Cabernet Sauvignon, Merlot' },
          { label: '타입', dbKey: 'wine_type', placeholder: '예: Red, White, 레드, 화이트' },
        ] as const).map(({ label, dbKey, placeholder }) => {
          const val = p.editFields[dbKey] || '';
          const orig = (selectedWine as unknown as Record<string, unknown>)[dbKey] || '';
          const changed = val.trim() !== orig;
          return (
            <div key={dbKey} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--gray-400)', minWidth: 60, flexShrink: 0 }}>{label}</span>
              <input
                value={val}
                onChange={e => p.setEditFields(f => ({ ...f, [dbKey]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') p.handleSaveField(dbKey); }}
                placeholder={placeholder}
                style={{
                  flex: 1, padding: '4px 8px', border: '1px solid var(--gray-300)', borderRadius: 4,
                  fontSize: 16, fontWeight: 500, color: '#1e293b',
                  background: val ? '#fff' : '#fef9c3',
                }}
              />
              {changed && (
                <button
                  onClick={() => p.handleSaveField(dbKey)}
                  disabled={p.savingField === dbKey}
                  style={{
                    padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', background: 'var(--color-primary-light)', color: '#fff',
                  }}
                >
                  {p.savingField === dbKey ? '...' : '저장'}
                </button>
              )}
            </div>
          );
        })}
        <DetailRow label="빈티지" value={selectedWine.vintage || '-'} />
        <DetailRow label="용량" value={selectedWine.volume_ml ? `${selectedWine.volume_ml}ml` : '-'} />
        <DetailRow label="알코올" value={selectedWine.alcohol || '-'} />
        <DetailRow label="공급가" value={selectedWine.supply_price != null ? `₩${selectedWine.supply_price.toLocaleString()}` : '-'} />
        <DetailRow label="재고" value={selectedWine.available_stock != null ? String(selectedWine.available_stock) : '-'} />
        <DetailRow label="상태" value={selectedWine.status} />
        <DetailRow label="AI조사" value={selectedWine.ai_researched ? '완료' : '미완료'} />
        <DetailRow label="등록일" value={selectedWine.created_at?.split('T')[0] || '-'} />
        <DetailRow label="수정일" value={selectedWine.updated_at?.split('T')[0] || '-'} />
      </div>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={handleResearch}
          disabled={researching}
          style={{
            width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #1a237e',
            background: '#e8eaf6', color: '#1a237e',
            fontWeight: 600, fontSize: 13, cursor: researching ? 'default' : 'pointer',
            opacity: researching ? 0.7 : 1,
          }}
        >
          {researching ? 'AI 조사 중...' : 'AI 조사'}
        </button>
        {researchMsg && (
          <div style={{
            fontSize: 12, textAlign: 'center', fontWeight: 500,
            color: researchMsg.startsWith('오류') || researchMsg.includes('실패') ? 'var(--status-danger)' : 'var(--status-success)',
          }}>
            {researchMsg}
          </div>
        )}
        <button
          onClick={() => p.handleDeleteSingle(selectedWine.item_code, selectedWine.item_name_kr)}
          disabled={p.deleting}
          style={{
            width: '100%', padding: '10px', borderRadius: 6, border: '1px solid var(--status-danger)',
            background: '#fef2f2', color: 'var(--status-danger)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          삭제
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ color: 'var(--gray-400)', minWidth: 60, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#1e293b', fontWeight: 500, wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
