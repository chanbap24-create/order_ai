'use client';

import { useCallback, useRef, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

/* ─── 업로드 영역 정의 ─── */
const UPLOAD_AREAS = [
  { type: 'client', label: '거래처별 와인 출고현황', description: 'Client 시트 데이터', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="2" x2="14" y2="2"/><line x1="10" y1="2" x2="10" y2="8"/><line x1="14" y1="2" x2="14" y2="8"/>
      <path d="M10 8 L8 10"/><path d="M14 8 L16 10"/><line x1="8" y1="10" x2="8" y2="20"/><line x1="16" y1="10" x2="16" y2="20"/>
      <path d="M8 20 L8 21 L16 21 L16 20"/><path d="M9 14 L15 14" opacity="0.5"/>
    </svg>
  )},
  { type: 'dl-client', label: '거래처별 글라스 출고현황', description: 'DL-Client 시트 데이터', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="18" y2="3"/><path d="M7 3 L7 8 C7 10 8.5 12 12 12 C15.5 12 17 10 17 8 L17 3"/>
      <line x1="12" y1="12" x2="12" y2="19"/><line x1="9" y1="19" x2="15" y2="19"/><path d="M9 19 L9 20 L15 20 L15 19"/>
    </svg>
  )},
  { type: 'riedel', label: '리델리스트', description: '리델 가격 리스트', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  )},
  { type: 'downloads', label: '와인재고현황', description: '와인 재고 현황 데이터', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )},
  { type: 'dl', label: '글라스재고현황', description: '글라스 재고 현황 데이터', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
    </svg>
  )},
  { type: 'english', label: '와인리스트', description: '와인 영문/한글 가격 리스트', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )},
] as const;

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadCardState {
  status: UploadStatus;
  fileName: string;
  message: string;
  isDragOver: boolean;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const ACCEPT = '.xlsx,.xls,.csv';

const UPLOAD_LABELS: Record<string, string> = {
  client: '거래처별 와인 출고현황',
  'dl-client': '거래처별 글라스 출고현황',
  riedel: '리델리스트',
  downloads: '와인재고현황',
  dl: '글라스재고현황',
  english: '와인리스트',
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return '업로드 기록 없음';
  const d = new Date(iso);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}월 ${dd}일 ${hh}:${mi}`;
}

const ADMIN_PASS = '0526';

export default function AdminPage() {
  // ── 비밀번호 게이트 ──
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState(false);

  // ── 상태 확인 ──
  const [statusResult, setStatusResult] = useState<any>(null);
  const [statusError, setStatusError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  // ── 업로드 상태 ──
  const [cards, setCards] = useState<Record<string, UploadCardState>>(
    Object.fromEntries(
      UPLOAD_AREAS.map((a) => [
        a.type,
        { status: 'idle' as UploadStatus, fileName: '', message: '', isDragOver: false },
      ])
    )
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const checkStatus = async () => {
    setIsChecking(true);
    setStatusError('');
    try {
      const response = await fetch('/api/sync-inventory');
      const data = await response.json();
      setStatusResult(data);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : '상태 확인 실패');
    } finally {
      setIsChecking(false);
    }
  };

  // ── 업로드 로직 ──
  function addToast(type: 'success' | 'error', message: string) {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  function updateCard(type: string, patch: Partial<UploadCardState>) {
    setCards((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }

  const handleUpload = useCallback(async (type: string, file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      addToast('error', '허용되지 않는 파일 형식입니다. (.xlsx, .xls, .csv)');
      return;
    }

    updateCard(type, { status: 'uploading', fileName: file.name, message: '' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/admin/upload/${type}`, { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok || !json.success) {
        const errMsg = json.error || `업로드 실패 (${res.status})`;
        updateCard(type, { status: 'error', message: errMsg });
        addToast('error', `${UPLOAD_AREAS.find((a) => a.type === type)?.label}: ${errMsg}`);
        return;
      }

      const details = Object.entries(json)
        .filter(([k]) => !['success', 'type', 'label', 'fileName', 'fileSize'].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      updateCard(type, { status: 'success', message: details || '업로드 완료' });
      addToast('success', `${UPLOAD_AREAS.find((a) => a.type === type)?.label} 업로드 완료`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '네트워크 오류';
      updateCard(type, { status: 'error', message: msg });
      addToast('error', `업로드 실패: ${msg}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authed) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 70px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-background)',
      }}>
        <div style={{
          textAlign: 'center',
          padding: 32,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          width: 320,
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>ADMIN</div>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>비밀번호를 입력하세요</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (pw === ADMIN_PASS) {
              setAuthed(true);
              setPwError(false);
            } else {
              setPwError(true);
            }
          }}>
            <input
              type="password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setPwError(false); }}
              placeholder="비밀번호"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 16,
                border: pwError ? '2px solid #e53e3e' : '1px solid #ddd',
                borderRadius: 8,
                outline: 'none',
                textAlign: 'center',
                letterSpacing: '0.2em',
                boxSizing: 'border-box',
              }}
            />
            {pwError && (
              <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 8 }}>비밀번호가 틀렸습니다</p>
            )}
            <button type="submit" style={{
              marginTop: 16,
              width: '100%',
              padding: '10px 0',
              background: '#8B1538',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              확인
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 70px)',
      padding: 'var(--space-6)',
      background: 'var(--color-background)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            marginBottom: 'var(--space-3)',
            color: '#8B4049',
          }}>
            관리자
          </h1>
        </div>

        {/* ── 상태 확인 섹션 ── */}
        <Card style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <h2 style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 700,
            }}>
              DB 상태
            </h2>
            <Button onClick={checkStatus} disabled={isChecking} variant="outline">
              {isChecking ? '확인 중...' : '상태 확인'}
            </Button>
          </div>

          {statusError && (
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'rgba(255, 59, 48, 0.08)',
              border: '1px solid rgba(255, 59, 48, 0.2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-error)',
              fontSize: 'var(--text-sm)',
            }}>
              {statusError}
            </div>
          )}

          {statusResult?.stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* DB 건수 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-3)',
              }}>
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--color-background)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ color: 'var(--color-text-light)' }}>CDV (와인)</span>
                  <span style={{ fontWeight: 700 }}>{statusResult.stats.cdv_items?.toLocaleString()}개</span>
                </div>
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--color-background)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ color: 'var(--color-text-light)' }}>DL (글라스)</span>
                  <span style={{ fontWeight: 700 }}>{statusResult.stats.dl_items?.toLocaleString()}개</span>
                </div>
              </div>

              {/* 파일별 업로드 시간 */}
              {statusResult.uploadTimestamps && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 'var(--space-2)',
                }}>
                  {Object.entries(statusResult.uploadTimestamps as Record<string, string | null>).map(([type, ts]) => (
                    <div key={type} style={{
                      padding: 'var(--space-2) var(--space-4)',
                      background: 'var(--color-background)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 'var(--text-sm)',
                    }}>
                      <span style={{ color: 'var(--color-text-light)', fontWeight: 600 }}>
                        {UPLOAD_LABELS[type] || type}
                      </span>
                      <span style={{
                        fontWeight: 500,
                        color: ts ? 'var(--color-text)' : 'var(--color-text-lighter)',
                        fontSize: 'var(--text-xs)',
                      }}>
                        {formatTimestamp(ts as string | null)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!statusResult && !statusError && (
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-lighter)',
            }}>
              상태 확인 버튼을 눌러 현재 DB 상태를 조회합니다.
            </p>
          )}
        </Card>

        {/* ── 엑셀 업로드 섹션 ── */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            marginBottom: 'var(--space-2)',
          }}>
            엑셀 업로드
          </h2>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-light)',
            marginBottom: 'var(--space-4)',
          }}>
            각 시트별 엑셀 파일을 업로드하여 DB 데이터를 교체합니다.
          </p>

          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: '#FFF8E1',
            border: '1px solid #FFE082',
            fontSize: 'var(--text-sm)',
            color: '#7C6800',
            marginBottom: 'var(--space-5)',
          }}>
            업로드 시 해당 테이블의 기존 데이터가 새 데이터로 교체됩니다. 트랜잭션으로 처리되어 오류 발생 시 자동 롤백됩니다.
          </div>
        </div>

        {/* ── Upload Grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 'var(--space-5)',
          marginBottom: 'var(--space-8)',
        }}>
          {UPLOAD_AREAS.map((area) => (
            <UploadCard
              key={area.type}
              area={area}
              state={cards[area.type]}
              onUpload={handleUpload}
              onDragState={(over) => updateCard(area.type, { isDragOver: over })}
            />
          ))}
        </div>
      </div>

      {/* ── Toast container ── */}
      <div style={{
        position: 'fixed',
        top: 90,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 9999,
        pointerEvents: 'none',
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              background: t.type === 'success' ? '#E8F5E9' : '#FFEBEE',
              border: `1px solid ${t.type === 'success' ? '#A5D6A7' : '#EF9A9A'}`,
              color: t.type === 'success' ? '#2E7D32' : '#C62828',
              fontSize: 'var(--text-sm)',
              maxWidth: 400,
              boxShadow: 'var(--shadow-lg)',
              pointerEvents: 'auto',
              animation: 'fadeInSlide 0.3s ease',
            }}
          >
            {t.type === 'success' ? '✓ ' : '✕ '}{t.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* ─── Upload Card Component ─── */
function UploadCard({
  area,
  state,
  onUpload,
  onDragState,
}: {
  area: (typeof UPLOAD_AREAS)[number];
  state: UploadCardState;
  onUpload: (type: string, file: File) => void;
  onDragState: (over: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    onDragState(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(area.type, file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    onDragState(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    onDragState(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(area.type, file);
    if (inputRef.current) inputRef.current.value = '';
  }

  const isUploading = state.status === 'uploading';
  const isOver = state.isDragOver;

  const borderColor = isOver
    ? 'var(--color-primary)'
    : state.status === 'success'
      ? 'var(--color-success)'
      : state.status === 'error'
        ? 'var(--color-error)'
        : 'var(--color-border)';

  return (
    <Card style={{
      border: `2px dashed ${borderColor}`,
      background: isOver
        ? 'rgba(139, 21, 56, 0.04)'
        : state.status === 'success'
          ? 'rgba(52, 199, 89, 0.04)'
          : state.status === 'error'
            ? 'rgba(255, 59, 48, 0.04)'
            : 'var(--color-card)',
      transition: 'all var(--transition-fast)',
      cursor: isUploading ? 'not-allowed' : 'pointer',
      opacity: isUploading ? 0.7 : 1,
    }}>
      <div
        onDrop={isUploading ? undefined : handleDrop}
        onDragOver={isUploading ? undefined : handleDragOver}
        onDragLeave={isUploading ? undefined : handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-6)',
          minHeight: 200,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={isUploading}
        />

        {/* Icon */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-xl)',
          background: 'rgba(139, 21, 56, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {area.icon}
        </div>

        {/* Label */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            color: 'var(--color-text)',
            marginBottom: 'var(--space-1)',
          }}>
            {area.label}
          </div>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-light)',
          }}>
            {area.description}
          </div>
        </div>

        {/* Status */}
        {isUploading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--space-1)' }}>
            <Spinner />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
              업로드 중... {state.fileName}
            </span>
          </div>
        )}

        {state.status === 'success' && (
          <div style={{
            fontSize: 'var(--text-xs)',
            color: '#2E7D32',
            textAlign: 'center',
            padding: 'var(--space-2) var(--space-3)',
            background: '#E8F5E9',
            borderRadius: 'var(--radius-sm)',
            maxWidth: '100%',
            wordBreak: 'break-all',
          }}>
            ✓ {state.fileName}<br />{state.message}
          </div>
        )}

        {state.status === 'error' && (
          <div style={{
            fontSize: 'var(--text-xs)',
            color: '#C62828',
            textAlign: 'center',
            padding: 'var(--space-2) var(--space-3)',
            background: '#FFEBEE',
            borderRadius: 'var(--radius-sm)',
            maxWidth: '100%',
            wordBreak: 'break-all',
          }}>
            ✕ {state.message}
          </div>
        )}

        {state.status === 'idle' && (
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-lighter)',
            textAlign: 'center',
          }}>
            파일을 드래그하거나 클릭하여 업로드<br />
            <span style={{ fontSize: '11px' }}>(.xlsx, .xls, .csv)</span>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─── Spinner ─── */
function Spinner() {
  return (
    <>
      <div style={{
        width: 16,
        height: 16,
        border: '2px solid var(--color-border)',
        borderTopColor: 'var(--color-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
