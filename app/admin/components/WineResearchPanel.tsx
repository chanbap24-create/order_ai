'use client';

import { useState } from 'react';
import Card from '@/app/components/ui/Card';
import type { Wine, WineResearchResult } from '@/app/types/wine';

interface WineResearchPanelProps {
  wine: Wine;
  researchData?: WineResearchResult | null;
  onSave: (itemCode: string, wineData: Partial<Wine>, noteData: Partial<WineResearchResult>) => void;
  onClose: () => void;
}

export default function WineResearchPanel({ wine, researchData, onSave, onClose }: WineResearchPanelProps) {
  const [form, setForm] = useState({
    item_name_en: wine.item_name_en || researchData?.item_name_en || '',
    country_en: wine.country_en || researchData?.country_en || '',
    region: wine.region || researchData?.region || '',
    grape_varieties: wine.grape_varieties || researchData?.grape_varieties || '',
    wine_type: wine.wine_type || researchData?.wine_type || '',
    winemaking: researchData?.winemaking || '',
    color_note: researchData?.color_note || '',
    nose_note: researchData?.nose_note || '',
    palate_note: researchData?.palate_note || '',
    food_pairing: researchData?.food_pairing || '',
    glass_pairing: researchData?.glass_pairing || '',
    serving_temp: researchData?.serving_temp || '',
    awards: researchData?.awards || '',
  });
  const [generatingPpt, setGeneratingPpt] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const wineData: Partial<Wine> = {
      item_name_en: form.item_name_en,
      country_en: form.country_en,
      region: form.region,
      grape_varieties: form.grape_varieties,
      wine_type: form.wine_type,
      ai_researched: 1,
    };

    const noteData: Partial<WineResearchResult> = {
      winemaking: form.winemaking,
      color_note: form.color_note,
      nose_note: form.nose_note,
      palate_note: form.palate_note,
      food_pairing: form.food_pairing,
      glass_pairing: form.glass_pairing,
      serving_temp: form.serving_temp,
      awards: form.awards,
    };

    onSave(wine.item_code, wineData, noteData);
  };

  const handleGeneratePpt = async () => {
    setGeneratingPpt(true);
    try {
      // 먼저 현재 데이터를 직접 저장 (onSave를 통하지 않음 - 패널 닫힘 방지)
      const saveRes = await fetch(`/api/admin/wines/${wine.item_code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wine: {
            item_name_en: form.item_name_en,
            country_en: form.country_en,
            region: form.region,
            grape_varieties: form.grape_varieties,
            wine_type: form.wine_type,
            ai_researched: 1,
          },
          tastingNote: {
            winemaking: form.winemaking,
            color_note: form.color_note,
            nose_note: form.nose_note,
            palate_note: form.palate_note,
            food_pairing: form.food_pairing,
            glass_pairing: form.glass_pairing,
            serving_temp: form.serving_temp,
            awards: form.awards,
          },
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({ error: `저장 실패 HTTP ${saveRes.status}` }));
        alert(`저장 오류: ${err.error || '알 수 없는 오류'}`);
        setGeneratingPpt(false);
        return;
      }

      // PPT 생성 요청
      const res = await fetch('/api/admin/tasting-notes/generate-ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineIds: [wine.item_code] }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${wine.item_code}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert(`PPT 생성 오류: ${err.error || '알 수 없는 오류'}`);
      }
    } catch (e) {
      alert(`PPT 생성 중 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
    setGeneratingPpt(false);
  };

  const fieldGroups = [
    {
      title: '와인 정보',
      fields: [
        { key: 'item_name_en', label: '영문명' },
        { key: 'country_en', label: '국가 (영문)' },
        { key: 'region', label: '지역' },
        { key: 'grape_varieties', label: '품종' },
        { key: 'wine_type', label: '와인 유형' },
      ],
    },
    {
      title: '양조 & 테이스팅',
      fields: [
        { key: 'winemaking', label: '양조 방법', multiline: true },
        { key: 'color_note', label: '색상 (Color)', multiline: true },
        { key: 'nose_note', label: '향 (Nose)', multiline: true },
        { key: 'palate_note', label: '맛 (Palate)', multiline: true },
      ],
    },
    {
      title: '페어링 & 기타',
      fields: [
        { key: 'food_pairing', label: '음식 페어링', multiline: true },
        { key: 'glass_pairing', label: '추천 글라스' },
        { key: 'serving_temp', label: '서빙 온도' },
        { key: 'awards', label: '수상내역', multiline: true },
      ],
    },
  ];

  return (
    <Card style={{ marginBottom: 'var(--space-6)', border: '2px solid var(--color-primary)', background: 'rgba(139,21,56,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
            와인 조사 결과
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>
            <strong>{wine.item_code}</strong> - {wine.item_name_kr}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: '#2563eb' }}
            onClick={handleGeneratePpt}
            disabled={generatingPpt}
          >
            {generatingPpt ? 'PPT 생성중...' : 'PPTX 저장'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>저장</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
        {fieldGroups.map((group) => (
          <div key={group.title}>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-light)', marginBottom: 'var(--space-3)', textTransform: 'uppercase' }}>
              {group.title}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {group.fields.map((f) => (
                <div key={f.key}>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-light)', display: 'block', marginBottom: 2 }}>
                    {f.label}
                  </label>
                  {f.multiline ? (
                    <textarea
                      className="input"
                      style={{ minHeight: 60, resize: 'vertical' }}
                      value={form[f.key as keyof typeof form]}
                      onChange={(e) => updateField(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      className="input"
                      value={form[f.key as keyof typeof form]}
                      onChange={(e) => updateField(f.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
