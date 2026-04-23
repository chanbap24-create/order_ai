'use client';

import { useEffect, useState } from 'react';
import type { Defaults, StockRuleConfig, WeightConfig } from '../types';

type ToastFn = (msg: string, type: 'success' | 'error') => void;

export function useRecommendSettings(onToast: ToastFn) {
  const [weights, setWeights] = useState<WeightConfig | null>(null);
  const [stockRules, setStockRules] = useState<StockRuleConfig | null>(null);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      .catch(() => onToast('설정을 불러올 수 없습니다.', 'error'))
      .finally(() => setLoading(false));
  }, [onToast]);

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
        onToast(json.error, 'error');
      } else {
        onToast('설정이 저장되었습니다.', 'success');
        setUpdatedAt(new Date().toISOString());
      }
    } catch {
      onToast('저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!defaults) return;
    setWeights({ ...defaults.weights });
    setStockRules({ ...defaults.stockRules });
  };

  const totalWeight = weights ? Object.values(weights).reduce((a, b) => a + b, 0) : 0;

  return {
    weights, stockRules, loading, saving, updatedAt, totalWeight,
    handleWeightChange, handleStockChange, handleSave, handleReset,
  };
}
