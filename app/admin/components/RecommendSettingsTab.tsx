'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRecommendSettings } from '../recommend-settings/hooks/useRecommendSettings';
import { WeightsCard } from '../recommend-settings/components/WeightsCard';
import { StockRulesCard } from '../recommend-settings/components/StockRulesCard';
import { ActionBar } from '../recommend-settings/components/ActionBar';

type Toast = { msg: string; type: 'success' | 'error' } | null;

export default function RecommendSettingsTab() {
  const [toast, setToast] = useState<Toast>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error') => setToast({ msg, type }), []);

  const s = useRecommendSettings(showToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (s.loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
        설정을 불러오는 중...
      </div>
    );
  }

  if (!s.weights || !s.stockRules) return null;

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{
        background: 'linear-gradient(135deg, var(--action), #8B2252)',
        borderRadius: 12, padding: '20px', marginBottom: 20, color: '#fff',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>AI 추천 가중치 설정</div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          각 추천 요소의 배점을 조정합니다. 합계는 100점에 가깝게 맞춰주세요.
        </div>
        {s.updatedAt && (
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
            마지막 수정: {new Date(s.updatedAt).toLocaleString('ko-KR')}
          </div>
        )}
      </div>

      <WeightsCard
        weights={s.weights}
        totalWeight={s.totalWeight}
        onChange={s.handleWeightChange}
      />

      <StockRulesCard
        stockRules={s.stockRules}
        onChange={s.handleStockChange}
      />

      <ActionBar
        totalWeight={s.totalWeight}
        saving={s.saving}
        onReset={s.handleReset}
        onSave={s.handleSave}
      />

      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#c53030' : '#38a169',
          color: '#fff', padding: '12px 24px', borderRadius: 8,
          fontSize: 14, fontWeight: 500, zIndex: 300,
          boxShadow: '0 4px 12px rgba(90,21,21,0.15)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
