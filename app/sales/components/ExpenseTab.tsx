'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ExcelJS from 'exceljs';

const ACCOUNT_CATEGORIES = [
  '복리후생비', '차량유지비', '여비교통비', '통신비', '접대비',
  '교육훈련비', '소모품비', '도서인쇄비', '운반비', '광고선전비',
  '지급수수료', '포장비', '견본비', '비품', '외주용역비',
];

interface ExpenseItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  account_category: string;
}

interface Props {
  currentManager: string;
  isAdmin: boolean;
}

export default function ExpenseTab({ currentManager }: Props) {
  // ── 엑셀 상태 ──
  const [workbook, setWorkbook] = useState<ExcelJS.Workbook | null>(null);
  const [fileName, setFileName] = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [excelLoading, setExcelLoading] = useState(false);

  // ── 영수증 상태 ──
  const [receiptPreview, setReceiptPreview] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<{
    date: string; description: string; amount: number; account_category: string; confidence: number;
  } | null>(null);

  // ── 편집 폼 ──
  const [editDate, setEditDate] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('복리후생비');
  const [editNote, setEditNote] = useState('');

  // ── 추가된 항목 ──
  const [items, setItems] = useState<ExpenseItem[]>([]);

  // ── 저장 상태 ──
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unsaved'>('idle');
  const [autoLoading, setAutoLoading] = useState(true);

  // ── 미리보기 패널 ──
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);

  // ── refs ──
  const excelInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // ── 현재 월 시트 이름 추정 ──
  const getCurrentMonthSheet = useCallback((names: string[]) => {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return names.find(n => n.includes(ym)) || names[0] || '';
  }, []);

  // ── 마운트 시 저장된 엑셀 자동 로드 ──
  useEffect(() => {
    if (!currentManager) { setAutoLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/sales/expense/file?manager=${encodeURIComponent(currentManager)}`);
        const data = await res.json();
        if (data.exists && data.data) {
          const buffer = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(buffer.buffer);
          const names = wb.worksheets.map(ws => ws.name).filter(n => n !== '계정과목');
          setWorkbook(wb);
          setFileName(data.fileName || `${currentManager}.xlsx`);
          setSheetNames(names);
          setSelectedSheet(getCurrentMonthSheet(names));
          setSaveStatus('saved');
        }
      } catch { /* 저장된 파일 없음 — 무시 */ }
      setAutoLoading(false);
    })();
  }, [currentManager, getCurrentMonthSheet]);

  // ── Storage에 저장 ──
  const handleSave = async () => {
    if (!workbook) return;
    setSaveStatus('saving');
    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const formData = new FormData();
      formData.append('manager', currentManager);
      formData.append('file', blob, `${currentManager}.xlsx`);
      const res = await fetch('/api/sales/expense/file', {
        method: 'PUT',
        body: formData,
      });
      const result = await res.json();
      if (result.ok) {
        setSaveStatus('saved');
      } else {
        alert('저장 실패: ' + (result.error || ''));
        setSaveStatus('unsaved');
      }
    } catch {
      alert('서버 연결 실패');
      setSaveStatus('unsaved');
    }
  };

  // ── 현재 파일 그대로 다운로드 (제출용) ──
  const handleDownloadCurrent = async () => {
    if (!workbook) return;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || `${currentManager}_경비.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── 미리보기 열기 ──
  const openPreview = () => {
    if (!workbook || !selectedSheet) return;
    const ws = workbook.getWorksheet(selectedSheet);
    if (!ws) return;
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum > 50) return; // 최대 50행
      const cells: string[] = [];
      for (let c = 1; c <= 4; c++) { // A~D만: 일자, 계정과목, 내역, 금액
        const v = row.getCell(c).value;
        cells.push(v != null ? String(v) : '');
      }
      rows.push(cells);
    });
    setPreviewRows(rows);
    setPreviewOpen(true);
  };

  // ── 엑셀 업로드 ──
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const names = wb.worksheets.map(ws => ws.name).filter(n => n !== '계정과목');
      setWorkbook(wb);
      setFileName(file.name);
      setSheetNames(names);
      const autoSheet = getCurrentMonthSheet(names);
      setSelectedSheet(autoSheet);
      setItems([]);
      setSaveStatus('unsaved');
    } catch {
      alert('엑셀 파일을 읽을 수 없습니다.');
    } finally {
      setExcelLoading(false);
    }
  };

  // ── 영수증 업로드 ──
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setReceiptPreview(base64);
      setParseResult(null);

      setParsing(true);
      try {
        const res = await fetch('/api/sales/expense/parse-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, manager: currentManager }),
        });
        const data = await res.json();
        if (data.error) {
          alert('파싱 실패: ' + data.error);
        } else {
          setParseResult(data);
          setEditDate(data.date || '');
          setEditDesc(data.description || '');
          setEditAmount(String(data.amount || ''));
          setEditCategory(data.account_category || '복리후생비');
          setEditNote('');
        }
      } catch {
        alert('서버 연결 실패');
      } finally {
        setParsing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── 항목 추가 ──
  const handleAddItem = () => {
    if (!editDate || !editDesc || !editAmount) {
      alert('일자, 내역, 금액을 모두 입력해주세요.');
      return;
    }
    const newItem: ExpenseItem = {
      id: Date.now().toString(),
      date: editDate,
      description: editDesc,
      amount: Number(editAmount) || 0,
      account_category: editCategory,
    };
    setItems(prev => [...prev, newItem]);
    setSaveStatus('unsaved');
    // 폼 리셋
    setParseResult(null);
    setReceiptPreview('');
    setEditDate('');
    setEditDesc('');
    setEditAmount('');
    setEditCategory('복리후생비');
    setEditNote('');
    if (receiptInputRef.current) receiptInputRef.current.value = '';
  };

  // ── 항목 삭제 ──
  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // ── 엑셀 다운로드 ──
  const handleDownload = async () => {
    if (!workbook || !selectedSheet || items.length === 0) {
      alert('엑셀 파일과 추가할 항목이 필요합니다.');
      return;
    }

    const ws = workbook.getWorksheet(selectedSheet);
    if (!ws) {
      alert('선택한 시트를 찾을 수 없습니다.');
      return;
    }

    // R11부터 빈 행 찾기
    let startRow = 11;
    while (startRow <= 1000) {
      const cellA = ws.getCell(`A${startRow}`).value;
      const cellD = ws.getCell(`D${startRow}`).value;
      if (!cellA && !cellD) break;
      startRow++;
    }

    // 항목 기입
    items.forEach((item, idx) => {
      const row = startRow + idx;
      ws.getCell(`A${row}`).value = item.date;
      ws.getCell(`B${row}`).value = item.account_category;
      ws.getCell(`C${row}`).value = item.description;
      ws.getCell(`D${row}`).value = item.amount;
      // 스타일 복사 (R11 기준)
      ['A', 'B', 'C', 'D', 'E'].forEach(col => {
        const srcCell = ws.getCell(`${col}11`);
        const tgtCell = ws.getCell(`${col}${row}`);
        if (srcCell.style) {
          tgtCell.style = { ...srcCell.style };
        }
      });
    });

    // blob 생성 & 다운로드
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.xlsx?$/i, '') + '_경비입력.xlsx';
    a.click();
    URL.revokeObjectURL(url);

    // 항목 기입 후 items 클리어 + 자동 저장
    setItems([]);
    handleSave();
  };

  // ── 스타일 상수 ──
  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid rgba(90,21,21,0.06)',
    boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
    padding: 18,
    marginBottom: 16,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
    background: '#faf9f7', boxSizing: 'border-box',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  };
  const btnPrimary: React.CSSProperties = {
    padding: '12px 24px', borderRadius: 10, border: 'none',
    background: '#5A1515', color: 'white', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', transition: 'background 0.2s ease',
  };

  return (
    <div>
      {/* ── 자동 로드 중 ── */}
      {autoLoading && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '32px 16px' }}>
          <div style={{
            width: 20, height: 20, border: '2px solid rgba(90,21,21,0.15)',
            borderTop: '2px solid #5A1515', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 10px',
          }} />
          <div style={{ fontSize: 13, color: '#8a8580' }}>저장된 엑셀 불러오는 중...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── 1. 엑셀 업로드 ── */}
      {!autoLoading && <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A1515" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          법인카드 엑셀
          {saveStatus === 'saved' && (
            <span style={{ fontSize: 11, fontWeight: 500, color: '#16a34a', marginLeft: 'auto' }}>
              저장됨
            </span>
          )}
          {saveStatus === 'unsaved' && (
            <span style={{ fontSize: 11, fontWeight: 500, color: '#E65100', marginLeft: 'auto' }}>
              미저장
            </span>
          )}
        </div>

        {!workbook ? (
          <div
            onClick={() => excelInputRef.current?.click()}
            style={{
              border: '2px dashed rgba(90,21,21,0.15)',
              borderRadius: 12,
              padding: '32px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s ease, background 0.2s ease',
              background: 'rgba(90,21,21,0.01)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.3)'; e.currentTarget.style.background = 'rgba(90,21,21,0.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(90,21,21,0.15)'; e.currentTarget.style.background = 'rgba(90,21,21,0.01)'; }}
          >
            {excelLoading ? (
              <div style={{ color: '#8a8580', fontSize: 13 }}>엑셀 로딩 중...</div>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8a8580" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#5A1515', marginBottom: 4 }}>법인카드 엑셀 파일 업로드</div>
                <div style={{ fontSize: 12, color: '#8a8580' }}>클릭하여 .xlsx 파일을 선택하세요</div>
              </>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{
                background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontSize: 12, fontWeight: 600,
                padding: '4px 10px', borderRadius: 6,
              }}>
                {fileName}
              </div>
              <button
                onClick={openPreview}
                style={{ background: 'none', border: 'none', color: '#5A1515', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >
                현황보기
              </button>
              <button
                onClick={handleDownloadCurrent}
                style={{ background: 'none', border: 'none', color: '#5A1515', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >
                다운로드
              </button>
              <button
                onClick={() => excelInputRef.current?.click()}
                style={{ background: 'none', border: 'none', color: '#8a8580', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >
                교체
              </button>
              <button
                onClick={() => { setWorkbook(null); setFileName(''); setSheetNames([]); setSelectedSheet(''); setItems([]); setSaveStatus('idle'); if (excelInputRef.current) excelInputRef.current.value = ''; }}
                style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >
                삭제
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ ...labelStyle, margin: 0 }}>시트</label>
              {sheetNames.map(name => (
                <button
                  key={name}
                  onClick={() => setSelectedSheet(name)}
                  style={{
                    padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: selectedSheet === name ? '1.5px solid #5A1515' : '1.5px solid rgba(90,21,21,0.1)',
                    background: selectedSheet === name ? 'rgba(90,21,21,0.06)' : 'transparent',
                    color: selectedSheet === name ? '#5A1515' : '#8a8580',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <input
          ref={excelInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleExcelUpload}
          style={{ display: 'none' }}
        />
      </div>}

      {/* ── 2. 영수증 촬영/업로드 ── */}
      {workbook && (
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A1515" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            영수증 촬영/업로드
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => receiptInputRef.current?.click()}
              style={{
                flex: 1, padding: '14px 16px', borderRadius: 10,
                border: '1.5px solid rgba(90,21,21,0.1)', background: '#faf9f7',
                fontSize: 13, fontWeight: 600, color: '#5A1515', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              카메라 촬영
            </button>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleReceiptUpload}
              style={{ display: 'none' }}
            />
          </div>

          {/* 영수증 미리보기 + 파싱 상태 */}
          {receiptPreview && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <img
                  src={receiptPreview}
                  alt="영수증"
                  style={{ width: 100, height: 'auto', borderRadius: 8, border: '1px solid rgba(90,21,21,0.08)', flexShrink: 0 }}
                />
                {parsing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8a8580', fontSize: 13, paddingTop: 8 }}>
                    <div style={{
                      width: 16, height: 16, border: '2px solid rgba(90,21,21,0.15)',
                      borderTop: '2px solid #5A1515', borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    AI 파싱 중...
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. 파싱 결과 편집 폼 ── */}
      {workbook && (parseResult || editDate) && !parsing && (
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', marginBottom: 14 }}>
            {parseResult ? '파싱 결과 확인' : '직접 입력'}
            {parseResult && parseResult.confidence >= 0.8 && (
              <span style={{ fontSize: 11, fontWeight: 500, color: '#16a34a', marginLeft: 8 }}>
                신뢰도 {Math.round(parseResult.confidence * 100)}%
              </span>
            )}
            {parseResult && parseResult.confidence < 0.8 && (
              <span style={{ fontSize: 11, fontWeight: 500, color: '#E65100', marginLeft: 8 }}>
                신뢰도 {Math.round(parseResult.confidence * 100)}% — 확인 필요
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>사용일자</label>
              <input
                type="date"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>계정과목</label>
              <select
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                style={{ ...inputStyle, color: '#2c1810' }}
              >
                {ACCOUNT_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>사용내역</label>
              <input
                type="text"
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="상호명 / 내용"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>금액</label>
              <input
                type="text"
                inputMode="numeric"
                value={editAmount}
                onChange={e => setEditAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                style={{ ...inputStyle, textAlign: 'right' }}
              />
              {editAmount && (
                <div style={{ fontSize: 11, color: '#8a8580', marginTop: 4, textAlign: 'right' }}>
                  {Number(editAmount).toLocaleString()}원
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>비고</label>
              <input
                type="text"
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                placeholder="선택사항"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button onClick={handleAddItem} style={btnPrimary}>
              항목 추가
            </button>
            <button
              onClick={() => {
                // 직접입력 모드 진입
                if (!editDate) {
                  const now = new Date();
                  setEditDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
                }
              }}
              style={{
                padding: '12px 24px', borderRadius: 10, border: '1.5px solid rgba(90,21,21,0.1)',
                background: 'transparent', fontSize: 14, fontWeight: 600,
                color: '#5A1515', cursor: 'pointer',
              }}
            >
              직접 입력
            </button>
          </div>
        </div>
      )}

      {/* 직접 입력 진입 버튼 (파싱결과 없을 때) */}
      {workbook && !parseResult && !editDate && !parsing && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <button
            onClick={() => {
              const now = new Date();
              setEditDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
            }}
            style={{
              padding: '12px 24px', borderRadius: 10, border: '1.5px solid rgba(90,21,21,0.15)',
              background: 'transparent', fontSize: 13, fontWeight: 600,
              color: '#5A1515', cursor: 'pointer',
            }}
          >
            영수증 없이 직접 입력
          </button>
        </div>
      )}

      {/* ── 4. 추가된 항목 리스트 ── */}
      {items.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>추가된 항목 ({items.length}건)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#5A1515' }}>
              합계 {items.reduce((s, i) => s + i.amount, 0).toLocaleString()}원
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, idx) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: '#faf9f7', borderRadius: 10, fontSize: 13,
              }}>
                <span style={{ color: '#8a8580', fontWeight: 600, minWidth: 20 }}>{idx + 1}</span>
                <span style={{ color: '#8a8580', minWidth: 80 }}>{item.date}</span>
                <span style={{
                  background: 'rgba(90,21,21,0.06)', color: '#5A1515', fontSize: 11,
                  fontWeight: 600, padding: '2px 8px', borderRadius: 5, flexShrink: 0,
                }}>{item.account_category}</span>
                <span style={{ flex: 1, color: '#2c1810', fontWeight: 500 }}>{item.description}</span>
                <span style={{ fontWeight: 700, color: '#2c1810', minWidth: 80, textAlign: 'right' }}>
                  {item.amount.toLocaleString()}
                </span>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0 }}
                  title="삭제"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. 저장 + 기입후 다운로드 ── */}
      {workbook && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            style={{
              ...btnPrimary,
              padding: '14px 28px', fontSize: 14,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              opacity: saveStatus === 'saving' ? 0.6 : 1,
              background: saveStatus === 'saved' ? '#16a34a' : '#5A1515',
            }}
          >
            {saveStatus === 'saving' ? (
              <>
                <div style={{
                  width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                저장 중...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                저장됨
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                저장
              </>
            )}
          </button>
          {items.length > 0 && (
            <button
              onClick={handleDownload}
              style={{
                padding: '14px 28px', borderRadius: 10, border: '1.5px solid rgba(90,21,21,0.15)',
                background: 'transparent', fontSize: 14, fontWeight: 600,
                color: '#5A1515', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              기입 후 다운로드
            </button>
          )}
        </div>
      )}

      {/* ── 6. 우측 슬라이드 미리보기 패널 ── */}
      {previewOpen && (
        <>
          {/* 오버레이 */}
          <div
            onClick={() => setPreviewOpen(false)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.3)', zIndex: 9998,
              transition: 'opacity 0.2s ease',
            }}
          />
          {/* 패널 */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: '90vw', maxWidth: 520,
            background: '#fff', zIndex: 9999,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column',
            animation: 'slideIn 0.25s ease',
          }}>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

            {/* 헤더 */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(90,21,21,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#2c1810' }}>
                  {selectedSheet} 현황
                </div>
                <div style={{ fontSize: 11, color: '#8a8580', marginTop: 2 }}>
                  {previewRows.length}행 표시
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={handleDownloadCurrent}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1.5px solid rgba(90,21,21,0.15)',
                    background: 'transparent', fontSize: 12, fontWeight: 600,
                    color: '#5A1515', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  다운로드
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  style={{
                    background: 'none', border: 'none', fontSize: 22, color: '#8a8580',
                    cursor: 'pointer', padding: '0 4px', lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* 테이블 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: 11,
              }}>
                <thead>
                  <tr>
                    {['사용일자', '계정과목', '사용내역', '금액'].map((h, i) => (
                      <th key={i} style={{
                        padding: '8px 6px', textAlign: i === 3 ? 'right' : 'left',
                        borderBottom: '2px solid rgba(90,21,21,0.1)',
                        color: '#8a8580', fontWeight: 600, fontSize: 10,
                        position: 'sticky', top: 0, background: '#fff',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} style={{
                      background: ri % 2 === 0 ? '#fff' : '#faf9f7',
                    }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{
                          padding: '6px',
                          borderBottom: '1px solid rgba(90,21,21,0.04)',
                          textAlign: ci === 3 ? 'right' : 'left',
                          color: '#2c1810',
                          whiteSpace: 'nowrap',
                          maxWidth: ci === 2 ? 160 : 100,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {ci === 3 && cell && !isNaN(Number(cell))
                            ? Number(cell).toLocaleString()
                            : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#8a8580', fontSize: 13 }}>
                  데이터가 없습니다
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
