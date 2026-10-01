'use client';

// 까브 매장 — 점장용 재고 확인 PWA (1단계: 3초 재고 답변).
// 구성: 로그인 → 매장 선택(1회) → 홈(검색+요약+오늘 들어온 와인) → 결과 → 상세 바텀시트.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { CORP_LABEL, STORES, type Corp, type StoreKey } from '@/app/lib/store/types';
import { StockRow } from './components/StockRow';
import { DetailSheet } from './components/DetailSheet';
import { useStoreApp } from './hooks/useStoreApp';
import { useCart } from './hooks/useCart';
import { CheckoutSheet } from './components/CheckoutSheet';
// 테이스팅 노트는 인벤토리와 동일 모듈 재사용 (복제 금지)
import { TastingNoteModal } from '../inventory/components/TastingNoteModal';
import { useTastingNoteModal } from '../inventory/hooks/useTastingNoteModal';

const fmt = (n: number) => n.toLocaleString('ko-KR');

// 소믈리에와 같은 브랜드 문법 — Didot 라틴 워드마크 + 골드 헤어라인
const LAT: CSSProperties = { fontFamily: 'Didot, "Bodoni 72", Georgia, serif', letterSpacing: '0.28em', fontWeight: 400 };
const GOLD_LINE = 'color-mix(in srgb, #b89a6a 32%, transparent)';

export default function StorePage() {
  const g = useStoreApp();
  const notes = useTastingNoteModal();
  const cart = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const storeLabel = STORES.find((s) => s.key === g.storeKey)?.label || '';
  // 소믈리에(취향 문답)로 이동 — 매장 선택을 그대로 넘긴다 (컬럼 키 동일)
  const openSommelier = () => {
    try { if (g.storeKey) localStorage.setItem('som_store', g.storeKey); } catch { /* ignore */ }
    window.location.href = '/sommelier';
  };
  // 설치 안내 — 이미 홈 화면 앱(standalone)으로 열렸으면 숨김
  const [installHintOff, setInstallHintOff] = useState(false);
  const standalone = typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

  // ── 로그인 ──
  if (g.authed === false) return <LoginScreen onLogin={g.login} />;
  if (g.authed === null) {
    return <div style={{ padding: '40vh 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>확인 중…</div>;
  }

  // ── 매장 선택 (최초 1회) ──
  if (!g.storeKey) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '15vh 24px 40px' }}>
        <h1 style={{ ...LAT, fontSize: 17, margin: '0 0 6px' }}>CAVE DE VIN</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>근무하는 매장을 선택하세요 (한 번만)</p>
        <div style={{ height: 1, background: GOLD_LINE, margin: '18px 0 22px' }} />
        {(['cdv', 'dl'] as Corp[]).map((corp) => (
          <div key={corp} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--text-tertiary)', padding: '0 0 7px 2px' }}>{CORP_LABEL[corp]}</div>
            <div style={{ borderTop: '1px solid var(--border-default)' }}>
              {STORES.filter((s) => s.corp === corp).map((s) => (
                <button key={s.key} onClick={() => g.setStoreKey(s.key)}
                  style={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', padding: '16px 4px', fontSize: 15.5, fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const showHome = !g.q.trim();

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '18px 16px calc(40px + env(safe-area-inset-bottom))' }}>
      {/* 헤더 — 소믈리에와 같은 워드마크, 매장명은 골드 밑줄(탭=매장 변경) */}
      <header>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          {/* 워드마크 탭 → 소믈리에 인트로(메인)로 복귀 */}
          <h1 style={{ margin: 0 }}>
            <button onClick={openSommelier} aria-label="소믈리에 메인으로"
              style={{ all: 'unset', cursor: 'pointer', ...LAT, fontSize: 15, color: 'var(--text-primary)' }}>
              CAVE DE VIN
            </button>
          </h1>
          <button onClick={() => g.setStoreKey('' as StoreKey)} aria-label="매장 변경"
            style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, color: 'var(--text-secondary)', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'rgba(184,154,106,0.6)' }}>
            {storeLabel}
          </button>
        </div>
        <div style={{ height: 1, background: GOLD_LINE, margin: '12px -16px 0' }} />
      </header>

      {/* 검색 — 엄지 존 최상단, 16px (iOS 줌 방지) */}
      <div style={{ marginTop: 14 }}>
        <input
          value={g.q}
          onChange={(e) => g.onInput(e.target.value)}
          placeholder="와인 이름 · 품번 검색"
          inputMode="search"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '13px 14px', fontSize: 16,
            border: '1.5px solid var(--action)', borderRadius: 12, outline: 'none', background: 'var(--surface)',
          }}
        />
      </div>

      {/* 최근 검색 */}
      {showHome && g.recent.length > 0 && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
          {g.recent.map((r) => (
            <button key={r} onClick={() => { g.onInput(r); void g.runSearch(r); }}
              style={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 999, padding: '6px 12px' }}>
              {r}
            </button>
          ))}
        </div>
      )}

      {/* 홈 — 요약 스트립 + 소믈리에 진입 + 오늘 들어온 와인 */}
      {showHome && (
        <>
          {/* 스탯 스트립 — 탭하면 해당 리스트 */}
          {g.summary && (
            <div style={{ display: 'flex', marginTop: 20, borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-subtle)' }}>
              {([
                ['우리 매장', `${fmt(g.summary.my_items)}종`, 'mine'],
                ['들어오는 중', `${fmt(g.summary.incoming_items)}종`, 'incoming'],
              ] as const).map(([k, v, mode], i) => (
                <button key={k} onClick={() => (g.listMode === mode ? g.closeList() : void g.openList(mode))}
                  style={{
                    all: 'unset', boxSizing: 'border-box', flex: 1, textAlign: 'center', padding: '13px 0', cursor: 'pointer',
                    borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                    background: g.listMode === mode ? 'var(--surface-muted)' : 'transparent',
                  }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{k}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                </button>
              ))}
            </div>
          )}

          {/* 소믈리에 진입 — 스트립과 한 몸(이중 라인 없이) */}
          <button onClick={openSommelier}
            style={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', textAlign: 'center', cursor: 'pointer', padding: '15px 2px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ ...LAT, fontSize: 13 }}>SOMMELIER</span>
            <span style={{ marginLeft: 10, fontSize: 13, color: '#b89a6a' }}>→</span>
          </button>

          {/* 보유/입고 리스트 — 요약 박스 탭 */}
          {g.listMode && (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '18px 2px 4px' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{g.listMode === 'mine' ? '우리 매장 보유' : '들어오는 중'}</span>
                {g.listRows && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmt(g.listRows.length)}종</span>}
                <button onClick={g.closeList}
                  style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>닫기</button>
              </div>
              {!g.listRows && <div style={{ padding: '16px 2px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>불러오는 중…</div>}
              {(g.listRows || []).map((row) => (
                <StockRow key={row.item_no} row={row} storeKey={g.storeKey as StoreKey} onOpen={() => void g.openDetail(row)}
                  onLongPress={notes.tastingNoteSet.has(row.item_no)
                    ? () => void notes.openFor(row.item_no, row.item_name)
                    : null}
                  onAdd={row.retail_price > 0 ? () => cart.add(row) : undefined} />
              ))}
            </div>
          )}
          {g.summary && g.summary.recent_arrivals.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '20px 2px 6px' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>이번 주 들어온 와인</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>통관 완료</span>
              </div>
              {g.summary.recent_arrivals.map((a) => (
                <button key={a.item_no} onClick={() => { g.onInput(a.item_no); void g.runSearch(a.item_no); }}
                  style={{ all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'baseline', gap: 8, width: '100%', cursor: 'pointer', padding: '10px 2px', borderBottom: '1px solid var(--border-subtle)', minWidth: 0 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.item_name}</span>
                  <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--status-success)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>본사 {fmt(a.hq_available)}</span>
                </button>
              ))}
            </>
          )}
        </>
      )}

      {/* 검색 결과 */}
      {!showHome && (
        <div style={{ marginTop: 8 }}>
          {g.searching && <div style={{ padding: '18px 2px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>검색 중…</div>}
          {g.error && <div style={{ padding: '14px 2px', fontSize: 13, color: 'var(--status-danger)' }}>{g.error}</div>}
          {!g.searching && g.rows && g.rows.length === 0 && (
            <div style={{ padding: '28px 2px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>검색 결과가 없습니다</div>
          )}
          {(g.rows || []).map((row) => (
            <StockRow key={row.item_no} row={row} storeKey={g.storeKey as StoreKey} onOpen={() => void g.openDetail(row)}
              onLongPress={notes.tastingNoteSet.has(row.item_no)
                ? () => void notes.openFor(row.item_no, row.item_name)
                : null}
              onAdd={row.retail_price > 0 ? () => cart.add(row) : undefined} />
          ))}
        </div>
      )}

      {g.detail && (
        <DetailSheet row={g.detail} storeKey={g.storeKey as StoreKey} alts={g.alts} onClose={() => g.setDetail(null)}
          onNote={notes.tastingNoteSet.has(g.detail.item_no)
            ? () => void notes.openFor(g.detail!.item_no, g.detail!.item_name)
            : null}
          onAdd={g.detail.retail_price > 0 ? () => cart.add(g.detail!) : undefined} />
      )}

      {/* POS 하단 바 — 바 전체가 버튼(탭=정산 화면), 담긴 게 있으면 상시 노출 */}
      {cart.items.length > 0 && !checkoutOpen && (
        <button onClick={() => setCheckoutOpen(true)} aria-label="정산 화면 열기"
          onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
          onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
          onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
          style={{
            position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 40,
            display: 'flex', alignItems: 'baseline', gap: 8, padding: '16px 18px',
            borderRadius: 13, border: 'none', background: 'var(--action)', color: '#fff', cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(0,0,0,0.18)', maxWidth: 536, margin: '0 auto',
            transition: 'transform 0.1s ease', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>정산 {cart.items.length}종 {fmt(cart.bottles)}병</span>
          <span style={{ marginLeft: 'auto', fontSize: 15.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(cart.finalTotal)}원 →
          </span>
        </button>
      )}

      {checkoutOpen && (
        <CheckoutSheet
          items={cart.items} bottles={cart.bottles} total={cart.total} retailTotal={cart.retailTotal}
          extraRate={cart.extraRate} extraWon={cart.extraWon} extraAmount={cart.extraAmount} finalTotal={cart.finalTotal}
          storeLabel={storeLabel}
          onQty={cart.setQty} onExtraRate={cart.setExtraRate} onExtraWon={cart.setExtraWon}
          onClear={() => { cart.clear(); setCheckoutOpen(false); }}
          onClose={() => setCheckoutOpen(false)} />
      )}

      <TastingNoteModal
        open={notes.showTastingNote}
        onClose={notes.close}
        selectedItemNo={notes.selectedItemNo}
        selectedWineName={notes.selectedWineName}
        loading={notes.tastingNoteLoading}
        source={notes.tastingNoteSource}
        pdfUrl={notes.tastingNoteUrl}
        originalPdfUrl={notes.originalPdfUrl}
        dbTastingNote={notes.dbTastingNote}
        dbWineInfo={notes.dbWineInfo}
        onDownload={notes.download}
      />

      {/* 홈 화면 설치 안내 — 브라우저로 열었을 때만 */}
      {!standalone && !installHintOff && (
        <div style={{ marginTop: 28, padding: '12px 14px', borderRadius: 10, background: 'var(--surface-muted)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, wordBreak: 'keep-all' }}>
          <b>홈 화면에 추가하면 앱처럼 쓸 수 있어요</b><br />
          iPhone: Safari 공유(⬆︎) → &quot;홈 화면에 추가&quot; · Android: Chrome 메뉴(⋮) → &quot;앱 설치&quot;<br />
          <span style={{ color: 'var(--text-tertiary)' }}>카톡으로 받은 링크는 Safari/Chrome에서 열어야 설치돼요.</span>
          <button onClick={() => setInstallHintOff(true)}
            style={{ all: 'unset', cursor: 'pointer', float: 'right', color: 'var(--text-tertiary)', fontSize: 12, padding: '0 2px' }}>닫기</button>
        </div>
      )}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (m: string, p: string) => Promise<string> }) {
  const [manager, setManager] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!manager.trim() || !password) return;
    setBusy(true); setErr('');
    const e = await onLogin(manager.trim(), password);
    if (e) setErr(e);
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '18vh 24px 40px' }}>
      <h1 style={{ ...LAT, fontSize: 17, margin: '0 0 6px' }}>CAVE DE VIN</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>매장 재고 — 직원 로그인</p>
      <div style={{ height: 1, background: GOLD_LINE, margin: '18px 0 24px' }} />
      <input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="이름" autoComplete="username" style={inputStyle} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" type="password" autoComplete="current-password"
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        style={{ ...inputStyle, marginTop: 10 }} />
      {err && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--status-danger)' }}>{err}</div>}
      <button onClick={() => void submit()} disabled={busy}
        style={{ marginTop: 16, width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 700, background: 'var(--action)', color: '#fff', border: 'none', borderRadius: 11, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? '로그인 중…' : '로그인'}
      </button>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '13px 14px', fontSize: 16,
  border: '1px solid var(--border-default)', borderRadius: 11, outline: 'none', background: 'var(--surface)',
};
