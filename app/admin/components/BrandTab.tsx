'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Brand, BrandWithWineCount, BrandResearchResult, BrandValidation } from '@/app/types/wine';

type ViewMode = 'list' | 'detail';

interface LinkedWine {
  item_code: string;
  item_name_kr: string;
  item_name_en: string | null;
  wine_type: string | null;
  vintage: string | null;
  supply_price: number | null;
  available_stock: number | null;
  status: string;
}

export default function BrandTab() {
  const [brands, setBrands] = useState<BrandWithWineCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [editForm, setEditForm] = useState<Partial<Brand>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);
  const [linkedWines, setLinkedWines] = useState<LinkedWine[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [validation, setValidation] = useState<BrandValidation | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 목록 로드
  const loadBrands = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (countryFilter) params.set('country', countryFilter);
    const res = await fetch(`/api/admin/brands?${params}`);
    if (res.ok) {
      setBrands(await res.json());
    }
    setLoading(false);
  }, [searchQuery, countryFilter]);

  useEffect(() => { loadBrands(); }, [loadBrands]);

  // 국가 목록
  const countries = [...new Set(brands.map(b => b.country).filter(Boolean))] as string[];

  // 상세 보기
  const openDetail = async (brand: Brand) => {
    setSelectedBrand(brand);
    setEditForm({ ...brand });
    setIsNew(false);
    setValidation(null);
    setViewMode('detail');
    // 연결된 와인 로드
    if (brand.brand_code) {
      const res = await fetch(`/api/admin/brands/${brand.id}`);
      if (res.ok) {
        const full = await res.json();
        setSelectedBrand(full);
        setEditForm({ ...full });
      }
      // 와인 목록은 brand_code로 직접 조회
      loadLinkedWines(brand.brand_code);
    } else {
      setLinkedWines([]);
    }
  };

  const loadLinkedWines = async (brandCode: string) => {
    try {
      const res = await fetch(`/api/admin/wines?search=${encodeURIComponent(brandCode)}`);
      if (res.ok) {
        const json = await res.json();
        const wines = json.data || json || [];
        // brand 코드가 정확히 일치하는 것만 필터
        const filtered = (wines as LinkedWine[]).filter((w: any) => w.brand === brandCode);
        setLinkedWines(filtered);
      } else {
        setLinkedWines([]);
      }
    } catch {
      setLinkedWines([]);
    }
  };

  // 신규
  const openNew = () => {
    setSelectedBrand(null);
    setEditForm({ brand_name_kr: '', brand_name_en: '', brand_code: '' });
    setIsNew(true);
    setLinkedWines([]);
    setViewMode('detail');
  };

  // 저장
  const handleSave = async () => {
    if (!editForm.brand_name_kr?.trim()) {
      showToast('브랜드 한글명은 필수입니다');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await fetch('/api/admin/brands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm),
        });
        if (res.ok) {
          const created = await res.json();
          showToast('브랜드가 생성되었습니다');
          setSelectedBrand(created);
          setEditForm({ ...created });
          setIsNew(false);
        } else {
          showToast('생성 실패');
        }
      } else if (selectedBrand) {
        const res = await fetch(`/api/admin/brands/${selectedBrand.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm),
        });
        if (res.ok) {
          const updated = await res.json();
          showToast('저장되었습니다');
          setSelectedBrand(updated);
          setEditForm({ ...updated });
        } else {
          showToast('저장 실패');
        }
      }
    } catch {
      showToast('오류가 발생했습니다');
    }
    setSaving(false);
  };

  // 삭제
  const handleDelete = async () => {
    if (!selectedBrand || !confirm('정말 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/admin/brands/${selectedBrand.id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('삭제되었습니다');
      setViewMode('list');
      loadBrands();
    }
  };

  // AI 조사 (3단계 병렬 검색 + 검증)
  const handleResearch = async () => {
    if (!editForm.brand_name_kr?.trim()) {
      showToast('브랜드 한글명을 먼저 입력하세요');
      return;
    }
    setResearching(true);
    setValidation(null);
    try {
      const res = await fetch('/api/admin/brands/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name_kr: editForm.brand_name_kr,
          brand_name_en: editForm.brand_name_en || '',
          country: editForm.country || '',
        }),
      });
      if (res.ok) {
        const { result, validation: v }: { result: BrandResearchResult; validation: BrandValidation } = await res.json();
        setValidation(v);
        // 빈 필드만 채움
        const merged = { ...editForm };
        if (!merged.brand_name_en && result.brand_name_en) merged.brand_name_en = result.brand_name_en;
        if (!merged.country && result.country) merged.country = result.country;
        if (!merged.region && result.region) merged.region = result.region;
        if (!merged.website && result.website) merged.website = result.website;
        if (!merged.description && result.description) merged.description = result.description;
        if (!merged.history && result.history) merged.history = result.history;
        if (!merged.winemaking_philosophy && result.winemaking_philosophy) merged.winemaking_philosophy = result.winemaking_philosophy;
        if (!merged.certifications && result.certifications) merged.certifications = result.certifications;
        if (!merged.founded_year && result.founded_year) merged.founded_year = result.founded_year;
        if (!merged.owner && result.owner) merged.owner = result.owner;
        if (!merged.winemaker && result.winemaker) merged.winemaker = result.winemaker;
        if (!merged.vineyard_info && result.vineyard_info) merged.vineyard_info = result.vineyard_info;
        if (!merged.annual_production && result.annual_production) merged.annual_production = result.annual_production;
        if (!merged.key_wines && result.key_wines) merged.key_wines = result.key_wines;
        if (!merged.awards && result.awards) merged.awards = result.awards;
        if (!merged.logo_url && result.logo_url) merged.logo_url = result.logo_url;
        if (!merged.image_url && result.image_url) merged.image_url = result.image_url;
        merged.ai_researched = true;
        setEditForm(merged);

        const confidenceMsg = v.confidence >= 90
          ? `신뢰도 ${v.confidence}%`
          : v.confidence >= 70
            ? `신뢰도 ${v.confidence}% — 일부 미확인 정보`
            : `신뢰도 ${v.confidence}% — 주의: 정보 확인 필요`;
        showToast(`AI 조사 완료 (${confidenceMsg})`);
      } else {
        const err = await res.json();
        showToast(`AI 조사 실패: ${err.error || '알 수 없는 오류'}`);
      }
    } catch {
      showToast('AI 조사 중 오류가 발생했습니다');
    }
    setResearching(false);
  };

  const updateField = (field: string, value: unknown) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // ─── 목록 뷰 ───
  if (viewMode === 'list') {
    return (
      <div>
        {/* 상단 바 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="브랜드 검색..."
            style={{
              flex: 1,
              minWidth: 160,
              height: 36,
              padding: '0 12px',
              border: '1px solid rgba(90,21,21,0.1)',
              borderRadius: 8,
              fontSize: 13,
              outline: 'none',
              background: '#fff',
            }}
          />
          <select
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            style={{
              height: 36,
              padding: '0 10px',
              border: '1px solid rgba(90,21,21,0.1)',
              borderRadius: 8,
              fontSize: 13,
              background: '#fff',
              color: countryFilter ? '#2c1810' : '#a8a098',
            }}
          >
            <option value="">전체 국가</option>
            {countries.sort().map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={openNew}
            style={{
              height: 36,
              padding: '0 16px',
              background: '#5A1515',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + 신규 등록
          </button>
        </div>

        {/* 카운트 */}
        <div style={{ fontSize: 12, color: '#a8a098', marginBottom: 12 }}>
          총 {brands.length}개 브랜드
        </div>

        {/* 카드 그리드 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#a8a098' }}>로딩 중...</div>
        ) : brands.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#a8a098' }}>
            등록된 브랜드가 없습니다
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {brands.map(brand => (
              <div
                key={brand.id}
                onClick={() => openDetail(brand)}
                style={{
                  background: '#fff',
                  border: '1px solid rgba(90,21,21,0.06)',
                  borderRadius: 10,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(90,21,21,0.08)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(90,21,21,0.12)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(90,21,21,0.06)';
                }}
              >
                {/* 브랜드 이미지/로고 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  {brand.image_url || brand.logo_url ? (
                    <img
                      src={brand.logo_url || brand.image_url || ''}
                      alt={brand.brand_name_kr}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        objectFit: 'cover',
                        background: '#f5f3f0',
                      }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #f5f3f0, #ebe8e4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#a8a098',
                    }}>
                      {brand.brand_code || brand.brand_name_kr.charAt(0)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#2c1810', lineHeight: 1.3 }}>
                      {brand.brand_name_kr}
                    </div>
                    {brand.brand_name_en && (
                      <div style={{ fontSize: 11, color: '#a8a098', lineHeight: 1.3 }}>
                        {brand.brand_name_en}
                      </div>
                    )}
                  </div>
                </div>

                {/* 정보 칩 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {brand.brand_code && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      background: 'rgba(90,21,21,0.06)',
                      color: '#5A1515',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}>
                      {brand.brand_code}
                    </span>
                  )}
                  {brand.country && (
                    <span style={{
                      fontSize: 10,
                      background: 'rgba(90,21,21,0.04)',
                      color: '#8a8580',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}>
                      {brand.country}
                    </span>
                  )}
                  {brand.region && (
                    <span style={{
                      fontSize: 10,
                      background: 'rgba(90,21,21,0.04)',
                      color: '#8a8580',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}>
                      {brand.region}
                    </span>
                  )}
                </div>

                {/* 설명 */}
                {brand.description && (
                  <div style={{
                    fontSize: 12,
                    color: '#6b6560',
                    lineHeight: 1.5,
                    marginBottom: 8,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {brand.description}
                  </div>
                )}

                {/* 하단: 와인 수 + AI 배지 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#a8a098' }}>
                    와인 {brand.wine_count}개
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {brand.ai_researched && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 600,
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        padding: '2px 5px',
                        borderRadius: 3,
                      }}>
                        AI
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#2c1810',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 13,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            zIndex: 9999,
            animation: 'fadeInSlide 0.3s ease',
          }}>
            {toast}
          </div>
        )}
      </div>
    );
  }

  // ─── 상세/편집 뷰 ───
  return (
    <div>
      {/* 상단 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => { setViewMode('list'); loadBrands(); }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 13,
            color: '#5A1515',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          목록
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleResearch}
          disabled={researching}
          style={{
            height: 34,
            padding: '0 14px',
            background: researching ? '#ccc' : '#1a73e8',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            cursor: researching ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {researching ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              조사 중...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              AI 조사
            </>
          )}
        </button>
        {!isNew && selectedBrand && (
          <button
            onClick={handleDelete}
            style={{
              height: 34,
              padding: '0 12px',
              background: 'rgba(220,53,69,0.08)',
              color: '#dc3545',
              border: 'none',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            삭제
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            height: 34,
            padding: '0 18px',
            background: saving ? '#ccc' : '#5A1515',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 검증 결과 배너 */}
      {validation && (
        <div style={{
          marginBottom: 12,
          padding: '10px 14px',
          borderRadius: 8,
          border: `1px solid ${validation.confidence >= 90 ? 'rgba(46,125,50,0.2)' : validation.confidence >= 70 ? 'rgba(237,108,2,0.2)' : 'rgba(211,47,47,0.2)'}`,
          background: validation.confidence >= 90 ? 'rgba(46,125,50,0.04)' : validation.confidence >= 70 ? 'rgba(237,108,2,0.04)' : 'rgba(211,47,47,0.04)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: validation.confidence >= 90 ? '#e8f5e9' : validation.confidence >= 70 ? '#fff3e0' : '#ffebee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: validation.confidence >= 90 ? '#2e7d32' : validation.confidence >= 70 ? '#ed6c02' : '#d32f2f',
            flexShrink: 0,
          }}>
            {validation.confidence}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: validation.confidence >= 90 ? '#2e7d32' : validation.confidence >= 70 ? '#ed6c02' : '#d32f2f',
              marginBottom: 2,
            }}>
              AI 검증 결과: 신뢰도 {validation.confidence}%
              {validation.confidence >= 90 ? ' — 정확' : validation.confidence >= 70 ? ' — 대체로 정확' : ' — 주의 필요'}
            </div>
            {validation.issues.length > 0 && (
              <div style={{ fontSize: 11, color: '#6b6560', lineHeight: 1.5 }}>
                {validation.issues.map((issue, i) => (
                  <div key={i}>• {issue}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 폼 섹션들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 기본 정보 */}
        <Section title="기본 정보">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <Field label="브랜드 코드" value={editForm.brand_code || ''} onChange={v => updateField('brand_code', v)} placeholder="예: RD, EM" />
            <Field label="한글명 *" value={editForm.brand_name_kr || ''} onChange={v => updateField('brand_name_kr', v)} placeholder="브랜드 한글명" />
            <Field label="영문명" value={editForm.brand_name_en || ''} onChange={v => updateField('brand_name_en', v)} placeholder="Brand English Name" />
            <Field label="국가" value={editForm.country || ''} onChange={v => updateField('country', v)} placeholder="France, Italy..." />
            <Field label="지역" value={editForm.region || ''} onChange={v => updateField('region', v)} placeholder="Bordeaux, Tuscany..." />
            <Field label="설립연도" value={editForm.founded_year?.toString() || ''} onChange={v => updateField('founded_year', v ? parseInt(v) : null)} placeholder="1850" type="number" />
            <Field label="웹사이트" value={editForm.website || ''} onChange={v => updateField('website', v)} placeholder="https://..." />
          </div>
        </Section>

        {/* 소개 */}
        <Section title="소개">
          <TextArea label="브랜드 소개" value={editForm.description || ''} onChange={v => updateField('description', v)} rows={3} />
          <TextArea label="역사" value={editForm.history || ''} onChange={v => updateField('history', v)} rows={3} />
          <TextArea label="양조 철학" value={editForm.winemaking_philosophy || ''} onChange={v => updateField('winemaking_philosophy', v)} rows={3} />
        </Section>

        {/* 생산 정보 */}
        <Section title="생산 정보">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <Field label="소유자" value={editForm.owner || ''} onChange={v => updateField('owner', v)} />
            <Field label="와인메이커" value={editForm.winemaker || ''} onChange={v => updateField('winemaker', v)} />
            <Field label="연간 생산량" value={editForm.annual_production || ''} onChange={v => updateField('annual_production', v)} />
            <Field label="인증" value={editForm.certifications || ''} onChange={v => updateField('certifications', v)} placeholder="유기농, 비오디나미 등" />
          </div>
          <TextArea label="포도밭 정보" value={editForm.vineyard_info || ''} onChange={v => updateField('vineyard_info', v)} rows={2} />
          <TextArea label="대표 와인" value={editForm.key_wines || ''} onChange={v => updateField('key_wines', v)} rows={2} />
          <TextArea label="수상 내역" value={editForm.awards || ''} onChange={v => updateField('awards', v)} rows={2} />
        </Section>

        {/* 이미지 */}
        <Section title="이미지">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <Field label="로고 URL" value={editForm.logo_url || ''} onChange={v => updateField('logo_url', v)} placeholder="https://..." />
            <Field label="이미지 URL" value={editForm.image_url || ''} onChange={v => updateField('image_url', v)} placeholder="https://..." />
          </div>
          {/* 이미지 미리보기 */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {editForm.logo_url && (
              <div>
                <div style={{ fontSize: 11, color: '#a8a098', marginBottom: 4 }}>로고</div>
                <img
                  src={editForm.logo_url}
                  alt="Logo"
                  style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 6, border: '1px solid rgba(90,21,21,0.08)' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
            {editForm.image_url && (
              <div>
                <div style={{ fontSize: 11, color: '#a8a098', marginBottom: 4 }}>이미지</div>
                <img
                  src={editForm.image_url}
                  alt="Brand"
                  style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(90,21,21,0.08)' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
          </div>
        </Section>

        {/* 메모 */}
        <Section title="메모">
          <TextArea label="메모" value={editForm.notes || ''} onChange={v => updateField('notes', v)} rows={3} />
        </Section>

        {/* 연결된 와인 */}
        {!isNew && editForm.brand_code && (
          <Section title={`연결된 와인 (${linkedWines.length}개)`}>
            {linkedWines.length === 0 ? (
              <div style={{ fontSize: 12, color: '#a8a098', padding: 12 }}>
                연결된 와인이 없습니다
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(90,21,21,0.08)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: '#a8a098', fontWeight: 500 }}>품번</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: '#a8a098', fontWeight: 500 }}>와인명</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: '#a8a098', fontWeight: 500 }}>타입</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: '#a8a098', fontWeight: 500 }}>가격</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: '#a8a098', fontWeight: 500 }}>재고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedWines.map(w => (
                      <tr key={w.item_code} style={{ borderBottom: '1px solid rgba(90,21,21,0.04)' }}>
                        <td style={{ padding: '6px 8px', color: '#5A1515', fontWeight: 500 }}>{w.item_code}</td>
                        <td style={{ padding: '6px 8px', color: '#2c1810' }}>{w.item_name_kr}</td>
                        <td style={{ padding: '6px 8px', color: '#8a8580' }}>{w.wine_type || '-'}</td>
                        <td style={{ padding: '6px 8px', color: '#2c1810', textAlign: 'right' }}>
                          {w.supply_price ? `${w.supply_price.toLocaleString()}원` : '-'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: (w.available_stock ?? 0) <= 0 ? '#dc3545' : '#2c1810' }}>
                          {w.available_stock ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: '#2c1810',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 8,
          fontSize: 13,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          zIndex: 9999,
          animation: 'fadeInSlide 0.3s ease',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid rgba(90,21,21,0.06)',
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: '#2c1810',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(90,21,21,0.06)',
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#a8a098', display: 'block', marginBottom: 3 }}>
        {label}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        type={type || 'text'}
        style={{
          width: '100%',
          height: 34,
          padding: '0 10px',
          border: '1px solid rgba(90,21,21,0.1)',
          borderRadius: 6,
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
          background: '#faf9f7',
        }}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, rows }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#a8a098', display: 'block', marginBottom: 3 }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows || 3}
        style={{
          width: '100%',
          padding: 10,
          border: '1px solid rgba(90,21,21,0.1)',
          borderRadius: 6,
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
          background: '#faf9f7',
          resize: 'vertical',
          lineHeight: 1.5,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}
