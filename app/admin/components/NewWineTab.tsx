'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Wine, TastingNote, WineResearchResult } from '@/app/types/wine';

interface WineWithStatus extends Wine {
  tasting_note_id: number | null;
  ai_generated: number;
  approved: number;
  verification_status: string | null;
  wine_status: 'detected' | 'researched' | 'approved' | 'mismatch';
}

type StatusFilter = 'all' | 'detected' | 'researched' | 'approved' | 'mismatch';

export default function NewWineTab() {
  // === 좌측 리스트 상태 ===
  const [wines, setWines] = useState<WineWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // === 우측 패널 상태 ===
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [tastingNote, setTastingNote] = useState<TastingNote | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [engNameInput, setEngNameInput] = useState('');
  const [researching, setResearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  // === 일괄 조사 상태 ===
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentName: '' });

  // === PPT/다운로드 상태 ===
  const [generatingPpt, setGeneratingPpt] = useState(false);
  const [batchPptRunning, setBatchPptRunning] = useState(false);
  const [batchPptProgress, setBatchPptProgress] = useState({ current: 0, total: 0 });
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [uploadingGithub, setUploadingGithub] = useState(false);
  const [dispatchingIndex, setDispatchingIndex] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);

  // ───── 와인 목록 로드 ─────
  const fetchWines = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('status', 'new');
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('wineStatus', statusFilter);
    try {
      const res = await fetch(`/api/admin/wines?${params}`);
      const data = await res.json();
      if (data.success) setWines(data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { fetchWines(); }, [fetchWines]);

  // ───── 편집 폼 초기화 헬퍼 ─────
  const initEditForm = (wine: Wine, tn: TastingNote | null) => {
    setEditForm({
      grape_varieties: wine.grape_varieties || '',
      region: wine.region || '',
      alcohol: wine.alcohol || '',
      serving_temp: tn?.serving_temp || '',
      winery_description: tn?.winery_description || '',
      winemaking: tn?.winemaking || '',
      vintage_note: tn?.vintage_note || '',
      color_note: tn?.color_note || '',
      nose_note: tn?.nose_note || '',
      palate_note: tn?.palate_note || '',
      food_pairing: tn?.food_pairing || '',
      glass_pairing: tn?.glass_pairing || '',
      awards: tn?.awards || '',
      aging_potential: tn?.aging_potential || '',
    });
  };

  // ───── 와인 상세 로드 (테이스팅 노트 비동기 로드) ─────
  const loadWineDetail = useCallback(async (itemCode: string) => {
    try {
      const res = await fetch(`/api/admin/wines/${itemCode}`);
      const data = await res.json();
      if (data.success) {
        setSelectedWine(data.data.wine);
        const tn = data.data.tastingNote || null;
        setTastingNote(tn);
        setEngNameInput(data.data.wine.item_name_en || '');
        initEditForm(data.data.wine, tn);
      }
    } catch (e) {
      console.error('와인 상세 로드 실패:', e);
    }
  }, []);

  const handleSelectWine = (itemCode: string) => {
    setSelectedId(itemCode);
    // 즉시 리스트 데이터로 우측 패널 표시
    const listWine = wines.find(w => w.item_code === itemCode);
    if (listWine) {
      setSelectedWine(listWine);
      setEngNameInput(listWine.item_name_en || '');
      setTastingNote(null);
      initEditForm(listWine, null);
    }
    // 비동기로 상세 데이터 (테이스팅 노트 포함) 로드
    loadWineDetail(itemCode);
  };

  // ───── 체크박스 ─────
  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllChecks = () => {
    if (checkedIds.size === wines.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(wines.map(w => w.item_code)));
    }
  };

  // ───── 영문명 저장 ─────
  const saveEngName = async () => {
    if (!selectedWine || !engNameInput.trim()) return;
    try {
      await fetch(`/api/admin/wines/${selectedWine.item_code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wine: { item_name_en: engNameInput.trim() } }),
      });
      setSelectedWine({ ...selectedWine, item_name_en: engNameInput.trim() });
      fetchWines();
    } catch { /* ignore */ }
  };

  // ───── AI 조사 (Claude) ─────
  const handleResearch = async () => {
    if (!selectedWine) return;
    const engName = engNameInput.trim() || selectedWine.item_name_en;
    if (!engName) {
      alert('영문명을 먼저 입력해주세요.');
      return;
    }
    setResearching(true);
    try {
      const res = await fetch('/api/admin/wine-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wine_id: selectedWine.item_code,
          product_name_eng: engName,
          item_name_kr: selectedWine.item_name_kr,
          vintage: selectedWine.vintage || '',
          supplier: selectedWine.supplier || selectedWine.supplier_kr || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.verification_status === 'warning') {
          alert('생산자 확인 필요: 조사된 와인의 생산자가 다를 수 있습니다. 확인 후 승인해주세요.');
        }
        await loadWineDetail(selectedWine.item_code);
        fetchWines();
      } else {
        alert(`조사 실패: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (e) {
      alert(`조사 중 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
    setResearching(false);
  };

  // ───── 일괄 조사 ─────
  const handleBatchResearch = async () => {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) {
      alert('일괄 조사할 와인을 선택하세요.');
      return;
    }
    // 영문명 없는 건 필터
    const validIds = ids.filter(id => {
      const w = wines.find(w => w.item_code === id);
      return w && w.item_name_en?.trim();
    });
    if (validIds.length === 0) {
      alert('선택한 와인 중 영문명이 입력된 것이 없습니다.');
      return;
    }

    setBatchRunning(true);
    setBatchProgress({ current: 0, total: validIds.length, currentName: '' });

    for (let i = 0; i < validIds.length; i++) {
      const id = validIds[i];
      const w = wines.find(w => w.item_code === id);
      setBatchProgress({ current: i + 1, total: validIds.length, currentName: w?.item_name_en || w?.item_name_kr || id });
      try {
        await fetch('/api/admin/wine-research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wine_id: id,
            product_name_eng: w?.item_name_en || '',
            item_name_kr: w?.item_name_kr || '',
            vintage: w?.vintage || '',
            supplier: w?.supplier || w?.supplier_kr || '',
          }),
        });
      } catch { /* continue */ }
    }

    setBatchRunning(false);
    setCheckedIds(new Set());
    fetchWines();
    if (selectedId) loadWineDetail(selectedId);
  };

  // ───── 저장 ─────
  const handleSave = async () => {
    if (!selectedWine) return;
    setSaving(true);
    try {
      // 와인 정보 저장
      await fetch(`/api/admin/wines/${selectedWine.item_code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wine: {
            grape_varieties: editForm.grape_varieties,
            region: editForm.region,
            alcohol: editForm.alcohol,
          },
        }),
      });
      // 테이스팅 노트 저장
      await fetch(`/api/admin/tasting-notes/${selectedWine.item_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serving_temp: editForm.serving_temp,
          winery_description: editForm.winery_description,
          winemaking: editForm.winemaking,
          vintage_note: editForm.vintage_note,
          color_note: editForm.color_note,
          nose_note: editForm.nose_note,
          palate_note: editForm.palate_note,
          food_pairing: editForm.food_pairing,
          glass_pairing: editForm.glass_pairing,
          awards: editForm.awards,
          aging_potential: editForm.aging_potential,
        }),
      });
      await loadWineDetail(selectedWine.item_code);
      fetchWines();
    } catch { /* ignore */ }
    setSaving(false);
  };

  // ───── 승인 ─────
  const handleApprove = async () => {
    if (!selectedWine) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/admin/tasting-notes/${selectedWine.item_code}/approve`, {
        method: 'PUT',
      });
      const data = await res.json();
      if (data.success) {
        await loadWineDetail(selectedWine.item_code);
        fetchWines();
      } else {
        alert(`승인 실패: ${data.error || '알 수 없는 오류'}`);
      }
    } catch { /* ignore */ }
    setApproving(false);
  };

  // ───── PPT 생성 ─────
  const handleGeneratePpt = async () => {
    if (!selectedWine) {
      alert('와인이 선택되지 않았습니다.');
      return;
    }
    setGeneratingPpt(true);
    try {
      const res = await fetch('/api/admin/tasting-notes/generate-ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineIds: [selectedWine.item_code] }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert(`PPT 생성 실패: ${errData.error || res.statusText}`);
        setGeneratingPpt(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedWine.item_code}.pptx`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      alert(`PPT 다운로드 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
    setGeneratingPpt(false);
  };

  // ───── 일괄 PPT 생성 (승인된 와인만) ─────
  const handleBatchPptGenerate = async () => {
    const approvedIds = Array.from(checkedIds).filter(id => {
      const w = wines.find(w => w.item_code === id);
      return w && w.wine_status === 'approved';
    });
    if (approvedIds.length === 0) {
      alert('승인된 와인을 선택하세요.');
      return;
    }
    setBatchPptRunning(true);
    setBatchPptProgress({ current: 0, total: approvedIds.length });

    for (let i = 0; i < approvedIds.length; i++) {
      setBatchPptProgress({ current: i + 1, total: approvedIds.length });
      try {
        await fetch('/api/admin/tasting-notes/generate-ppt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wineIds: [approvedIds[i]] }),
        });
      } catch { /* continue */ }
    }

    setBatchPptRunning(false);
    fetchWines();
    alert(`${approvedIds.length}개 PPT 생성 완료`);
  };

  // ───── ZIP 다운로드 ─────
  const handleDownloadZip = async () => {
    const approvedIds = Array.from(checkedIds).filter(id => {
      const w = wines.find(w => w.item_code === id);
      return w && w.wine_status === 'approved';
    });
    if (approvedIds.length === 0) {
      alert('승인된 와인을 선택하세요.');
      return;
    }
    setDownloadingZip(true);
    try {
      const res = await fetch('/api/admin/tasting-notes/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineIds: approvedIds }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasting-notes-${approvedIds.length}wines.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        alert(`ZIP 생성 실패: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (e) {
      alert(`ZIP 다운로드 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
    setDownloadingZip(false);
  };

  // ───── GitHub 릴리스 업로드 ─────
  const handleGithubRelease = async (format: 'pptx' | 'pdf') => {
    const approvedIds = Array.from(checkedIds).filter(id => {
      const w = wines.find(w => w.item_code === id);
      return w && w.wine_status === 'approved';
    });
    if (approvedIds.length === 0) {
      alert('승인된 와인을 선택하세요.');
      return;
    }
    const label = format.toUpperCase();
    if (!confirm(`${approvedIds.length}개 와인의 ${label}을 GitHub에 업로드하시겠습니까?`)) return;

    setUploadingGithub(true);
    try {
      const res = await fetch('/api/admin/github-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineIds: approvedIds, format }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`${label} GitHub 업로드 완료: 성공 ${data.uploaded}개, 실패 ${data.failed}개`);
      } else {
        alert(`${label} GitHub 업로드 실패: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (e) {
      alert(`GitHub 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
    setUploadingGithub(false);
  };

  // ───── 인덱스 업데이트 (GitHub Actions) ─────
  const handleDispatchIndex = async () => {
    if (!confirm('GitHub Actions 워크플로우를 실행하여 인덱스를 업데이트하시겠습니까?')) return;
    setDispatchingIndex(true);
    try {
      const res = await fetch('/api/admin/github-dispatch', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('인덱스 업데이트 워크플로우가 실행되었습니다. GitHub Actions에서 진행 상황을 확인하세요.');
      } else {
        alert(`워크플로우 실행 실패: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (e) {
      alert(`오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
    setDispatchingIndex(false);
  };

  // ───── 상태 배지 ─────
  const statusBadge = (ws: string) => {
    if (ws === 'approved') return { label: '승인완료', color: '#16a34a', bg: '#dcfce7', icon: '🟢' };
    if (ws === 'mismatch') return { label: '재조사필요', color: '#dc2626', bg: '#fee2e2', icon: '🔴' };
    if (ws === 'researched') return { label: '조사완료', color: '#ca8a04', bg: '#fef9c3', icon: '🟡' };
    return { label: '감지됨', color: '#2563eb', bg: '#dbeafe', icon: '🔵' };
  };

  const updateField = (key: string, val: string) => setEditForm(prev => ({ ...prev, [key]: val }));

  // ───── 카운트 ─────
  const counts = {
    all: wines.length,
    detected: wines.filter(w => w.wine_status === 'detected').length,
    researched: wines.filter(w => w.wine_status === 'researched').length,
    mismatch: wines.filter(w => w.wine_status === 'mismatch').length,
    approved: wines.filter(w => w.wine_status === 'approved').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      {/* ─── 상단 컨트롤 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: 'rgba(90,21,21,0.05)', borderRadius: 8, padding: 2 }}>
          {(['all', 'detected', 'researched', 'mismatch', 'approved'] as StatusFilter[]).map(f => {
            const labels: Record<StatusFilter, string> = { all: '전체', detected: '감지됨', researched: '조사완료', mismatch: '재조사', approved: '승인완료' };
            const isActive = statusFilter === f;
            return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: '0.75rem', cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isActive ? 'white' : 'transparent',
                  color: isActive ? '#5A1515' : '#a8a098',
                  boxShadow: isActive ? '0 1px 3px rgba(90,21,21,0.08)' : 'none',
                  fontWeight: 600, whiteSpace: 'nowrap',
                }}
              >
                {labels[f]} ({counts[f]})
              </button>
            );
          })}
          </div>
          <input
            style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16, width: 200 }}
            placeholder="와인명/품번 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={handleBatchResearch}
            disabled={batchRunning || checkedIds.size === 0}
            style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: '0.75rem', cursor: 'pointer',
              transition: 'all 0.2s ease', fontWeight: 600, whiteSpace: 'nowrap',
              background: batchRunning ? '#5A1515' : 'rgba(90,21,21,0.05)',
              color: batchRunning ? '#fff' : '#a8a098',
              opacity: checkedIds.size === 0 && !batchRunning ? 0.5 : 1,
            }}
          >
            {batchRunning ? `${batchProgress.current}/${batchProgress.total} 조사 중...` : `일괄조사 (${checkedIds.size})`}
          </button>
          <button
            onClick={handleBatchPptGenerate}
            disabled={batchPptRunning || checkedIds.size === 0}
            style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: '0.75rem', cursor: 'pointer',
              transition: 'all 0.2s ease', fontWeight: 600, whiteSpace: 'nowrap',
              background: batchPptRunning ? '#5A1515' : 'rgba(90,21,21,0.05)',
              color: batchPptRunning ? '#fff' : '#a8a098',
              opacity: checkedIds.size === 0 ? 0.5 : 1,
            }}
          >
            {batchPptRunning ? `${batchPptProgress.current}/${batchPptProgress.total} PPT...` : `일괄PPT (${checkedIds.size})`}
          </button>
          <button
            onClick={() => handleGithubRelease('pptx')}
            disabled={uploadingGithub || checkedIds.size === 0}
            style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: '0.75rem', cursor: 'pointer',
              transition: 'all 0.2s ease', fontWeight: 600, whiteSpace: 'nowrap',
              background: 'rgba(90,21,21,0.05)', color: '#a8a098',
              opacity: checkedIds.size === 0 ? 0.5 : 1,
            }}
          >
            {uploadingGithub ? '업로드...' : 'PPTX'}
          </button>
          <button
            onClick={() => handleGithubRelease('pdf')}
            disabled={uploadingGithub || checkedIds.size === 0}
            style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: '0.75rem', cursor: 'pointer',
              transition: 'all 0.2s ease', fontWeight: 600, whiteSpace: 'nowrap',
              background: 'rgba(90,21,21,0.05)', color: '#a8a098',
              opacity: checkedIds.size === 0 ? 0.5 : 1,
            }}
          >
            {uploadingGithub ? '업로드...' : 'PDF'}
          </button>
          <button
            onClick={handleDispatchIndex}
            disabled={dispatchingIndex}
            style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: '0.75rem', cursor: 'pointer',
              transition: 'all 0.2s ease', fontWeight: 600, whiteSpace: 'nowrap',
              background: 'rgba(90,21,21,0.05)', color: '#a8a098',
            }}
          >
            {dispatchingIndex ? '실행 중...' : '인덱스'}
          </button>
        </div>
      </div>

      {/* 일괄 조사 진행바 */}
      {batchRunning && (
        <div style={{ padding: '8px 12px', background: '#f5f3ff', borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
          <div style={{ marginBottom: 4, color: '#6d28d9', fontWeight: 600 }}>
            {batchProgress.current}/{batchProgress.total} 조사 중... (현재: {batchProgress.currentName})
          </div>
          <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2 }}>
            <div style={{ height: '100%', background: '#7c3aed', borderRadius: 2, width: `${(batchProgress.current / batchProgress.total) * 100}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* 일괄 PPT 진행바 */}
      {batchPptRunning && (
        <div style={{ padding: '8px 12px', background: '#e0f2fe', borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
          <div style={{ marginBottom: 4, color: '#0369a1', fontWeight: 600 }}>
            {batchPptProgress.current}/{batchPptProgress.total} PPT 생성 중...
          </div>
          <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2 }}>
            <div style={{ height: '100%', background: '#0ea5e9', borderRadius: 2, width: `${(batchPptProgress.current / batchPptProgress.total) * 100}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* ─── 3단 분할 패널 ─── */}
      <div style={{ display: 'flex', flex: 1, gap: 12, overflow: 'hidden' }}>

        {/* ─── 좌측: 와인 리스트 ─── */}
        <div ref={listRef} style={{ width: 340, minWidth: 300, overflowY: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', flexShrink: 0 }}>
          {/* 리스트 헤더 */}
          <div style={{ padding: '10px 12px', borderBottom: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
            <input
              type="checkbox"
              checked={wines.length > 0 && checkedIds.size === wines.length}
              onChange={toggleAllChecks}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>전체선택</span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>로딩 중...</div>
          ) : wines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
              신규 와인이 없습니다.
            </div>
          ) : (
            wines.map(w => {
              const badge = statusBadge(w.wine_status);
              const isSelected = selectedId === w.item_code;
              return (
                <div
                  key={w.item_code}
                  onClick={() => handleSelectWine(w.item_code)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : '#fff',
                    borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.has(w.item_code)}
                    onChange={(e) => { e.stopPropagation(); toggleCheck(w.item_code); }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 14 }}>{badge.icon}</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {w.item_name_kr}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {w.item_code} {w.item_name_en ? `· ${w.item_name_en}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: badge.bg, color: badge.color, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {badge.label}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* ─── 중앙: 편집 패널 ─── */}
        <div style={{ flex: 1, minWidth: 320, overflowY: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          {!selectedWine ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 15 }}>
              좌측에서 와인을 선택하세요
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              {/* 기본정보 (읽기전용) */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
                  {selectedWine.item_name_kr}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 13 }}>
                  <InfoRow label="품번" value={selectedWine.item_code} />
                  <InfoRow label="국가" value={selectedWine.country || selectedWine.country_en || '-'} />
                  <InfoRow label="공급가" value={selectedWine.supply_price != null ? `₩${selectedWine.supply_price.toLocaleString()}` : '-'} />
                  <InfoRow label="와인타입" value={selectedWine.wine_type || '-'} />
                  <InfoRow label="빈티지" value={selectedWine.vintage || '-'} />
                  <InfoRow label="용량" value={selectedWine.volume_ml ? `${selectedWine.volume_ml}ml` : '-'} />
                </div>
              </div>

              {/* 이미지 */}
              {selectedWine.image_url && (
                <div style={{ marginBottom: 16, textAlign: 'center' }}>
                  <img
                    src={selectedWine.image_url}
                    alt={selectedWine.item_name_kr}
                    style={{ maxHeight: 200, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                </div>
              )}

              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginBottom: 16 }}>
                {/* 영문명 입력 */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>영문명</label>
                  <input
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16 }}
                    placeholder="English wine name..."
                    value={engNameInput}
                    onChange={(e) => setEngNameInput(e.target.value)}
                  />
                  <button
                    onClick={saveEngName}
                    style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    저장
                  </button>
                </div>

                {/* AI 조사 버튼 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <button
                    onClick={handleResearch}
                    disabled={researching || !engNameInput.trim()}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 6, border: 'none', fontSize: 14, cursor: 'pointer',
                      background: researching ? '#9ca3af' : !engNameInput.trim() ? '#d1d5db' : '#7c3aed',
                      color: '#fff', fontWeight: 600,
                    }}
                  >
                    {researching ? '🔄 Claude AI 조사 중...' : !engNameInput.trim() ? '영문명을 먼저 입력하세요' : '🤖 AI 조사 시작'}
                  </button>
                  {tastingNote && (
                    <button
                      onClick={handleResearch}
                      disabled={researching || !engNameInput.trim()}
                      style={{
                        padding: '10px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer',
                        color: !engNameInput.trim() ? '#d1d5db' : '#6b7280',
                      }}
                    >
                      재조사
                    </button>
                  )}
                </div>
              </div>

              {/* 조사 결과 편집 폼 */}
              {(tastingNote || Object.values(editForm).some(v => v)) && (
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>
                    조사 결과 {tastingNote?.ai_generated ? '(AI 생성)' : ''}
                    {tastingNote?.verification_status && (() => {
                      const vsMap: Record<string, { label: string; color: string; bg: string }> = {
                        verified: { label: '검증완료', color: '#16a34a', bg: '#dcfce7' },
                        warning: { label: '생산자 확인 필요', color: '#d97706', bg: '#fef3c7' },
                        mismatch: { label: '생산자 불일치', color: '#dc2626', bg: '#fee2e2' },
                        approved: { label: '승인완료', color: '#2563eb', bg: '#dbeafe' },
                        pending: { label: '검증대기', color: '#9ca3af', bg: '#f3f4f6' },
                      };
                      const vs = vsMap[tastingNote.verification_status || ''];
                      return vs ? (
                        <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: vs.bg, color: vs.color, fontWeight: 600 }}>
                          {vs.label}
                        </span>
                      ) : null;
                    })()}
                  </h4>

                  {/* 생산자 확인 경고 배너 */}
                  {tastingNote?.verification_status === 'warning' && (
                    <div style={{ padding: '10px 14px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#92400e' }}>
                      <b>생산자 확인 필요</b> - AI 조사 결과의 생산자가 원본({selectedWine?.supplier || selectedWine?.supplier_kr || '미등록'})과 다를 수 있습니다.
                    </div>
                  )}
                  {tastingNote?.verification_status === 'mismatch' && (
                    <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#991b1b' }}>
                      <b>생산자 불일치</b> - 다른 생산자의 와인이 조사되었습니다. 재조사가 필요합니다.
                    </div>
                  )}

                  <SectionTitle title="기본 와인 정보" />
                  <FormRow label="품종" value={editForm.grape_varieties} onChange={(v) => updateField('grape_varieties', v)} />
                  <FormRow label="산지" value={editForm.region} onChange={(v) => updateField('region', v)} />
                  <FormRow label="알코올" value={editForm.alcohol} onChange={(v) => updateField('alcohol', v)} placeholder="예: 13.5%" />
                  <FormRow label="서빙온도" value={editForm.serving_temp} onChange={(v) => updateField('serving_temp', v)} placeholder="예: 16-18°C" />

                  <SectionTitle title="와이너리 / 양조" />
                  <FormTextarea label="와이너리 소개" value={editForm.winery_description} onChange={(v) => updateField('winery_description', v)} rows={2} />
                  <FormTextarea label="양조 방법" value={editForm.winemaking} onChange={(v) => updateField('winemaking', v)} rows={3} />
                  <FormTextarea label="빈티지 특성" value={editForm.vintage_note} onChange={(v) => updateField('vintage_note', v)} rows={2} />

                  <SectionTitle title="테이스팅 노트" />
                  <FormTextarea label="컬러/외관" value={editForm.color_note} onChange={(v) => updateField('color_note', v)} rows={2} />
                  <FormTextarea label="노즈/향" value={editForm.nose_note} onChange={(v) => updateField('nose_note', v)} rows={3} />
                  <FormTextarea label="팔렛/맛" value={editForm.palate_note} onChange={(v) => updateField('palate_note', v)} rows={3} />

                  <SectionTitle title="페어링 / 기타" />
                  <FormTextarea label="푸드 페어링" value={editForm.food_pairing} onChange={(v) => updateField('food_pairing', v)} rows={2} />
                  <FormRow label="글라스 페어링" value={editForm.glass_pairing} onChange={(v) => updateField('glass_pairing', v)} placeholder="예: 보르도 글라스" />
                  <FormTextarea label="수상 내역" value={editForm.awards} onChange={(v) => updateField('awards', v)} rows={2} />
                  <FormRow label="숙성 잠재력" value={editForm.aging_potential} onChange={(v) => updateField('aging_potential', v)} placeholder="예: 5-10년 숙성 가능" />

                  {/* 하단 버튼들 */}
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                    {/* 저장/승인 행 */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 6, border: 'none', fontSize: 14, cursor: 'pointer',
                          background: saving ? '#9ca3af' : '#2563eb', color: '#fff', fontWeight: 600,
                        }}
                      >
                        {saving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                    {/* PPT/다운로드 행 */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleGeneratePpt()}
                        disabled={generatingPpt || !tastingNote}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #d1d5db',
                          background: generatingPpt ? '#fef3c7' : tastingNote ? '#fff' : '#f3f4f6',
                          fontSize: 13, cursor: tastingNote && !generatingPpt ? 'pointer' : 'not-allowed',
                          color: tastingNote ? '#374151' : '#d1d5db', fontWeight: 600,
                        }}
                      >
                        {generatingPpt ? 'PPT 생성중...' : !tastingNote ? 'PPT (조사 필요)' : 'PPT 다운로드'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── 우측: 조사 결과 상세 패널 (토글) ─── */}
        {selectedWine && showDetailPanel && (
          <div style={{ width: 380, minWidth: 320, overflowY: 'auto', background: '#fafbfc', borderRadius: 8, border: '1px solid #e5e7eb', flexShrink: 0, position: 'relative' }}>
            {/* 접기 버튼 */}
            <button
              onClick={() => setShowDetailPanel(false)}
              style={{
                position: 'sticky', top: 8, float: 'right', margin: '8px 8px 0 0', zIndex: 2,
                width: 28, height: 28, borderRadius: '50%', border: '1px solid #d1d5db',
                background: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="패널 접기"
            >
              ✕
            </button>

            {!tastingNote || !tastingNote.ai_generated ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14, padding: 40, textAlign: 'center' }}>
                조사를 먼저 진행해주세요
              </div>
            ) : (
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
                  AI 조사 원본 데이터
                </div>

                <DetailSection icon="🏰" title="와이너리 상세" content={tastingNote.winery_description} />
                <DetailSection icon="🍷" title="양조 방법 상세" content={tastingNote.winemaking} />
                <DetailSection icon="📅" title="빈티지 특성" content={tastingNote.vintage_note} />

                <DetailSection icon="🎨" title="테이스팅 노트 상세" content={null}>
                  <DetailField label="컬러" value={tastingNote.color_note} />
                  <DetailField label="노즈" value={tastingNote.nose_note} />
                  <DetailField label="팔렛" value={tastingNote.palate_note} />
                </DetailSection>

                <DetailSection icon="🍽️" title="페어링 상세" content={null}>
                  <DetailField label="푸드 페어링" value={tastingNote.food_pairing} />
                  <DetailField label="글라스 페어링" value={tastingNote.glass_pairing} />
                </DetailSection>

                <DetailSection icon="🏆" title="수상/평가" content={tastingNote.awards} />
                <DetailSection icon="⏳" title="숙성 잠재력" content={tastingNote.aging_potential} />

                {tastingNote.serving_temp && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: '#e0f2fe', borderRadius: 6, fontSize: 12, color: '#0369a1' }}>
                    🌡️ 서빙 온도: {tastingNote.serving_temp}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 우측 패널 접혔을 때 펼치기 버튼 */}
        {selectedWine && !showDetailPanel && (
          <button
            onClick={() => setShowDetailPanel(true)}
            style={{
              writingMode: 'vertical-rl', padding: '12px 6px', borderRadius: '8px',
              border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer',
              fontSize: 12, color: '#6b7280', fontWeight: 600, flexShrink: 0,
            }}
            title="상세 패널 펼치기"
          >
            ◀ 조사 상세
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 헬퍼 컴포넌트 ───

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ color: '#9ca3af', minWidth: 60 }}>{label}</span>
      <span style={{ color: '#1e293b', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {title}
    </div>
  );
}

function FormRow({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <label style={{ fontSize: 13, color: '#374151', minWidth: 90, fontWeight: 500 }}>{label}</label>
      <input
        style={{ flex: 1, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16 }}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function FormTextarea({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
      <textarea
        style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16, resize: 'vertical', lineHeight: 1.5 }}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
      />
    </div>
  );
}

function DetailSection({ icon, title, content, children }: { icon: string; title: string; content?: string | null; children?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6, borderBottom: '1px solid #e5e7eb', paddingBottom: 4 }}>
        {icon} {title}
      </div>
      {content ? (
        <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {content}
        </div>
      ) : children ? (
        <div>{children}</div>
      ) : (
        <div style={{ fontSize: 12, color: '#d1d5db', fontStyle: 'italic' }}>정보 없음</div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}
