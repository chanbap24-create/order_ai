'use client';

import { useState, useEffect } from 'react';

interface WeightConfig {
  REORDER: number;
  COUNTRY_MATCH: number;
  GRAPE_MATCH: number;
  TYPE_MATCH: number;
  PRICE_FIT: number;
  SALES_VELOCITY: number;
  SEASONAL: number;
  UPSELL: number;
}

interface StockRuleConfig {
  price_300k: number;
  price_200k: number;
  price_100k: number;
  price_50k: number;
  price_20k: number;
  price_under_20k: number;
  months_supply: number;
}

const WEIGHT_LABELS: Record<keyof WeightConfig, { label: string; desc: string; color: string }> = {
  REORDER: { label: '재주문', desc: '과거 2회+ 구매 후 3개월 미발주 와인', color: '#2196F3' },
  COUNTRY_MATCH: { label: '선호 국가', desc: '거래처가 자주 구매하는 국가의 와인', color: '#9C27B0' },
  GRAPE_MATCH: { label: '선호 품종', desc: '거래처가 자주 구매하는 품종의 와인', color: '#E91E63' },
  TYPE_MATCH: { label: '선호 타입', desc: '거래처가 선호하는 와인 타입 (레드/화이트/스파클링 등)', color: '#00897B' },
  PRICE_FIT: { label: '가격 적합도', desc: '거래처 평균 구매가 ±20% 이내', color: '#4CAF50' },
  SALES_VELOCITY: { label: '판매 인기도', desc: '전체 판매량 기준 인기 와인', color: '#FF5722' },
  SEASONAL: { label: '시즌 매치', desc: '현재 계절에 어울리는 와인 타입/품종', color: '#5C6BC0' },
  UPSELL: { label: '프리미엄', desc: '평균 구매가 대비 20~50% 높은 업셀링', color: '#FF9800' },
};

const STOCK_LABELS: Record<keyof StockRuleConfig, { label: string; unit: string }> = {
  price_300k: { label: '30만원 이상', unit: '병' },
  price_200k: { label: '20만원 이상', unit: '병' },
  price_100k: { label: '10만원 이상', unit: '병' },
  price_50k: { label: '5만원 이상', unit: '병' },
  price_20k: { label: '2만원 이상', unit: '병' },
  price_under_20k: { label: '2만원 미만', unit: '병' },
  months_supply: { label: '최소 여유분', unit: '개월' },
};

export default function RecommendSettingsTab() {
  const [weights, setWeights] = useState<WeightConfig | null>(null);
  const [stockRules, setStockRules] = useState<StockRuleConfig | null>(null);
  const [defaults, setDefaults] = useState<{ weights: WeightConfig; stockRules: StockRuleConfig } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/recommend-settings')
      .then(r => r.json())
      .then(d => {
        setWeights(d.weights);
        setStockRules(d.stockRules);
        setDefaults(d.defaults);
        setUpdatedAt(d.updated_at);
      })
      .catch(() => showToast('설정을 불러올 수 없습니다.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  const totalWeight = weights
    ? Object.values(weights).reduce((a, b) => a + b, 0)
    : 0;

  const handleWeightChange = (key: keyof WeightConfig, val: string) => {
    if (!weights) return;
    const num = parseInt(val) || 0;
    setWeights({ ...weights, [key]: Math.max(0, Math.min(100, num)) });
  };

  const handleStockChange = (key: keyof StockRuleConfig, val: string) => {
    if (!stockRules) return;
    const num = parseInt(val) || 0;
    setStockRules({ ...stockRules, [key]: Math.max(0, num) });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/recommend-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights, stockRules }),
      });
      const json = await res.json();
      if (json.error) {
        showToast(json.error, 'error');
      } else {
        showToast('설정이 저장되었습니다.', 'success');
        setUpdatedAt(new Date().toISOString());
      }
    } catch {
      showToast('저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!defaults) return;
    setWeights({ ...defaults.weights });
    setStockRules({ ...defaults.stockRules });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999', fontSize: 14 }}>
        설정을 불러오는 중...
      </div>
    );
  }

  if (!weights || !stockRules) return null;

  const totalColor = totalWeight === 100 ? '#4CAF50' : totalWeight > 90 && totalWeight < 110 ? '#FF9800' : '#c62828';

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, #5A1515, #8B2252)',
        borderRadius: 12, padding: '20px', marginBottom: 20, color: '#fff',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>AI 추천 가중치 설정</div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          각 추천 요소의 배점을 조정합니다. 합계는 100점에 가깝게 맞춰주세요.
        </div>
        {updatedAt && (
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
            마지막 수정: {new Date(updatedAt).toLocaleString('ko-KR')}
          </div>
        )}
      </div>

      {/* ── 가중치 설정 ── */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '20px 16px',
        marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid #f0ece4',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>추천 점수 가중치</div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: totalColor,
            padding: '4px 12px', borderRadius: 20,
            background: `${totalColor}14`,
          }}>
            합계: {totalWeight}점
          </div>
        </div>

        {/* 비주얼 바 */}
        <div style={{
          display: 'flex', borderRadius: 8, overflow: 'hidden',
          height: 28, marginBottom: 20, border: '1px solid #f0ece4',
        }}>
          {(Object.keys(WEIGHT_LABELS) as (keyof WeightConfig)[]).map(key => {
            const w = weights[key];
            const pct = totalWeight > 0 ? (w / totalWeight) * 100 : 0;
            if (pct < 1) return null;
            return (
              <div key={key} style={{
                width: `${pct}%`,
                background: WEIGHT_LABELS[key].color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'width 0.3s',
                minWidth: pct > 5 ? undefined : 0,
              }}>
                {pct > 8 && (
                  <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {WEIGHT_LABELS[key].label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 슬라이더 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(Object.keys(WEIGHT_LABELS) as (keyof WeightConfig)[]).map(key => {
            const info = WEIGHT_LABELS[key];
            const val = weights[key];
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: 3,
                      background: info.color, display: 'inline-block', flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{info.label}</span>
                    <span style={{ fontSize: 11, color: '#999' }}>{info.desc}</span>
                  </div>
                  <input
                    type="number"
                    value={val}
                    onChange={e => handleWeightChange(key, e.target.value)}
                    min={0}
                    max={100}
                    style={{
                      width: 52, textAlign: 'center', fontSize: 14, fontWeight: 700,
                      border: '1px solid #e0dcd4', borderRadius: 6, padding: '4px 0',
                      color: info.color, outline: 'none',
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={val}
                  onChange={e => handleWeightChange(key, e.target.value)}
                  style={{
                    width: '100%', height: 6,
                    accentColor: info.color,
                    cursor: 'pointer',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 재고 기준 설정 ── */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '20px 16px',
        marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid #f0ece4',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>
          추천 가능 재고 기준
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
          가격대별 최소 재고가 이 기준 미만이면 추천에서 제외됩니다.
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {(Object.keys(STOCK_LABELS) as (keyof StockRuleConfig)[]).map(key => {
            const info = STOCK_LABELS[key];
            const val = stockRules[key];
            const isSpecial = key === 'months_supply';
            return (
              <div key={key} style={{
                background: isSpecial ? '#faf5ff' : '#fafaf8',
                borderRadius: 8, padding: '12px 14px',
                border: isSpecial ? '1px solid #e8d5f5' : '1px solid #f0ece4',
              }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 500 }}>
                  {info.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    value={val}
                    onChange={e => handleStockChange(key, e.target.value)}
                    min={0}
                    style={{
                      width: 70, fontSize: 16, fontWeight: 700,
                      border: '1px solid #e0dcd4', borderRadius: 6, padding: '6px 8px',
                      color: '#1a1a2e', outline: 'none', textAlign: 'right',
                    }}
                  />
                  <span style={{ fontSize: 13, color: '#888' }}>{info.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 하단 액션 ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid #e0dcd4',
        padding: '12px 16px', zIndex: 200,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
      }}>
        <div style={{ maxWidth: 1250, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 12, color: '#888' }}>
            가중치 합계: <span style={{ fontWeight: 700, color: totalColor }}>{totalWeight}점</span>
            {totalWeight !== 100 && <span style={{ color: '#FF9800', marginLeft: 8 }}>(권장: 100점)</span>}
          </div>
          <button onClick={handleReset} style={{
            padding: '10px 20px', borderRadius: 8, border: '1px solid #e0dcd4',
            background: '#fff', color: '#666', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>초기화</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: saving ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
          }}>{saving ? '저장 중...' : '저장'}</button>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#c53030' : '#38a169',
          color: '#fff', padding: '12px 24px', borderRadius: 8,
          fontSize: 14, fontWeight: 500, zIndex: 300,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>{toast.msg}</div>
      )}
    </div>
  );
}
