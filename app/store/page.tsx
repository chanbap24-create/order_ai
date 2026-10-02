'use client';

// 까브 매장 — 점장용 재고 확인 + POS 정산 PWA.
// 구성: 로그인 → 매장 선택(1회) → 홈(검색 + StoreHome) → 결과 → 상세 바텀시트 → 정산 시트.
import { useEffect, useState } from 'react';
import { CORP_LABEL, STORES, sortByTier, type Corp, type StoreKey, type StoreStockRow } from '@/app/lib/store/types';
import { StockRow } from './components/StockRow';
import { DetailSheet } from './components/DetailSheet';
import { CheckoutSheet } from './components/CheckoutSheet';
import { SearchBar } from './components/SearchBar';
import { StoreHome } from './components/StoreHome';
import { LoginScreen } from './components/LoginScreen';
import { useStoreApp } from './hooks/useStoreApp';
import { useCart } from './hooks/useCart';
import { fmt, GOLD_LINE, LAT } from './brand';
// 테이스팅 노트는 인벤토리와 동일 모듈 재사용 (복제 금지)
import { TastingNoteModal } from '../inventory/components/TastingNoteModal';
import { useTastingNoteModal } from '../inventory/hooks/useTastingNoteModal';

export default function StorePage() {
  const g = useStoreApp();
  const notes = useTastingNoteModal();
  const cart = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // 소믈리에 결과 → '정산' 바로 진입 (?checkout=1)
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get('checkout')) return;
    const t = setTimeout(() => setCheckoutOpen(true), 0);
    window.history.replaceState(null, '', '/store');
    return () => clearTimeout(t);
  }, []);
  const storeLabel = STORES.find((s) => s.key === g.storeKey)?.label || '';
  // 로고 → 매장 앱 메인(소믈리에 인트로). 매장 선택은 그대로 넘긴다(컬럼 키 동일).
  // 손님 응대 중 취향 문답으로 이어가기는 정산 시트의 '이어서 취향 문답으로' 링크가 담당.
  const goMain = () => {
    try { if (g.storeKey) localStorage.setItem('som_store', g.storeKey); } catch { /* ignore */ }
    window.location.href = '/sommelier';
  };
  const searchNow = (q: string) => { g.onInput(q); void g.runSearch(q); };

  // 검색 결과·보유 리스트 공용 행 배선 (탭=상세, 꾹=노트, +=담기)
  const renderRow = (row: StoreStockRow) => (
    <StockRow key={row.item_no} row={row} storeKey={g.storeKey as StoreKey} onOpen={() => void g.openDetail(row)}
      onLongPress={notes.tastingNoteSet.has(row.item_no) ? () => void notes.openFor(row.item_no, row.item_name) : null}
      onAdd={row.retail_price > 0 ? () => cart.add(row) : undefined} />
  );

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
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px calc(96px + env(safe-area-inset-bottom))' }}>
      {/* 헤더 — 워드마크(탭=소믈리에 메인) · 매장명(탭=매장 변경) */}
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h1 style={{ margin: 0 }}>
          <button onClick={goMain} aria-label="매장 앱 메인으로"
            style={{ all: 'unset', cursor: 'pointer', ...LAT, fontSize: 15, color: 'var(--text-primary)' }}>
            CAVE DE VIN
          </button>
        </h1>
        <button onClick={() => g.setStoreKey('' as StoreKey)} aria-label="매장 변경"
          style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'rgba(184,154,106,0.6)' }}>
          {storeLabel}
        </button>
      </header>
      <div style={{ height: 1, background: GOLD_LINE, margin: '14px -16px 24px' }} />

      <SearchBar value={g.q} onChange={g.onInput} />

      {showHome ? (
        <StoreHome
          recent={g.recent} onRecent={searchNow} onClearRecent={g.clearRecent}
          summary={g.summary} listMode={g.listMode} listRows={g.listRows}
          onToggleList={(mode) => (g.listMode === mode ? g.closeList() : void g.openList(mode))}
          onCloseList={g.closeList}
          onArrival={searchNow} renderRow={renderRow} />
      ) : (
        <div style={{ marginTop: 8 }}>
          {g.searching && <div style={{ padding: '18px 2px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>검색 중…</div>}
          {g.error && <div style={{ padding: '14px 2px', fontSize: 13, color: 'var(--status-danger)' }}>{g.error}</div>}
          {!g.searching && g.rows && g.rows.length === 0 && (
            <div style={{ padding: '28px 2px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>검색 결과가 없습니다</div>
          )}
          {/* 우리 매장 → 다른 매장 → 본사 순으로 묶어서(음영 구역이 섞이지 않게) */}
          {sortByTier(g.rows || [], g.storeKey as StoreKey).map(renderRow)}
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
          onClose={() => setCheckoutOpen(false)}
          onQuiz={() => {
            try {
              const k = localStorage.getItem('cave_store_key');
              if (k) localStorage.setItem('som_store', k);
            } catch { /* ignore */ }
            window.location.href = '/sommelier?quiz=1';
          }} />
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
    </div>
  );
}
