'use client';

// 까브 매장 — 점장용 재고 확인 + POS 정산 PWA.
// 구성: 로그인 → 매장 선택(1회) → 홈(검색 + StoreHome) → 결과 → 상세 바텀시트 → 정산 시트.
import { logoutStoreApp } from '@/app/store/lib/logout';
import { useEffect, useRef, useState } from 'react';
import { CORP_LABEL, STORES, sortByTier, type Corp, type StoreKey, type StoreStockRow } from '@/app/lib/store/types';
import { StockRow } from './components/StockRow';
import { DetailSheet } from './components/DetailSheet';
import { CheckoutSheet } from './components/CheckoutSheet';
import { SearchBar } from './components/SearchBar';
import { StoreHome } from './components/StoreHome';
import { GuestBadge } from './components/GuestBadge';
import { RestockAlertsSheet } from './components/RestockAlertsSheet';
import { useRestockAlerts } from './hooks/useRestockAlerts';
import { readGuest } from '@/app/lib/store/cartSession';
import { AppsMenu, AppsMenuButton, MenuIcons, type AppsMenuItem } from './components/AppsMenu';
import { LoginScreen } from './components/LoginScreen';
import { useStoreApp, type ListMode } from './hooks/useStoreApp';
import { useCart } from './hooks/useCart';
import { fmt, GOLD, GOLD_LINE, LAT } from './brand';
// 테이스팅 노트는 인벤토리와 동일 모듈 재사용 (복제 금지)
import { TastingNoteModal } from '../inventory/components/TastingNoteModal';
import { useTastingNoteModal } from '../inventory/hooks/useTastingNoteModal';

export default function StorePage() {
  const g = useStoreApp();
  const notes = useTastingNoteModal();
  const cart = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // 헤더 메뉴(⋮⋮⋮)
  const restock = useRestockAlerts(g.authed === true && !!g.storeKey);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const openAlerts = () => { setAlertsOpen(true); void restock.refresh(); };
  // 소믈리에 결과 → '정산' 바로 진입 (?checkout=1)
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get('checkout')) return;
    const t = setTimeout(() => setCheckoutOpen(true), 0);
    window.history.replaceState(null, '', '/store');
    return () => clearTimeout(t);
  }, []);
  // 메인(소믈리에 인트로) 메뉴 → 목록 바로 열기 (?open=mine|incoming|alerts). 로그인·매장 확정 뒤 1회
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || g.authed !== true || !g.storeKey) return;
    deepLinked.current = true;
    const open = new URLSearchParams(window.location.search).get('open');
    if (!open) return;
    window.history.replaceState(null, '', '/store');
    const t = setTimeout(() => {
      if (open === 'mine' || open === 'incoming') void g.openList(open);
      else if (open === 'alerts') { setAlertsOpen(true); void restock.refresh(); }
    }, 0);
    return () => clearTimeout(t);
  }, [g, restock]);
  const storeLabel = STORES.find((s) => s.key === g.storeKey)?.label || '';
  // 로고 → 매장 앱 메인(소믈리에 인트로). 매장 선택은 그대로 넘긴다(컬럼 키 동일).
  // 손님 응대 중 맞춤 추천으로 이어가기는 메뉴 첫 칸·정산 시트 링크가 담당(goQuiz).
  // 맞춤 추천(취향 문답)으로 바로 — 응대 중 손님·카트 유지(손님 미지정이면 소믈리에가 손님 정보부터)
  const goQuiz = () => {
    try { if (g.storeKey) localStorage.setItem('som_store', g.storeKey); } catch { /* ignore */ }
    window.location.href = '/sommelier?quiz=1';
  };
  const goMain = () => {
    try { if (g.storeKey) localStorage.setItem('som_store', g.storeKey); } catch { /* ignore */ }
    window.location.href = '/sommelier';
  };
  const searchNow = (q: string) => { g.onInput(q); void g.runSearch(q); };

  // 검색 결과·보유 리스트 공용 행 배선 (탭=상세, 꾹=노트, +=담기)
  const renderRow = (row: StoreStockRow) => (
    <StockRow key={row.item_no} row={row} storeKey={g.storeKey as StoreKey} onOpen={() => void g.openDetail(row)}
      onLongPress={notes.tastingNoteSet.has(row.item_no) ? () => void notes.openFor(row.item_no, row.item_name) : null}
      onAdd={row.retail_price > 0 ? () => cart.add(row) : undefined}
      // 입고 예정 목록에선 + 대신 입고 알림(벨) — 손님 미지정이면 상세(안내)로
      onAlert={!g.q.trim() && g.listMode === 'incoming'
        ? () => { if (!readGuest()) void g.openDetail(row); else void restock.toggle(row.item_no, row.item_name, g.storeKey); }
        : undefined}
      alerted={restock.alertedItems.has(row.item_no)} />
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
  const EASE = '0.32s cubic-bezier(0.32, 0.72, 0, 1)'; // 첫 화면 ↔ 검색 화면 전환
  // 첫 화면(구글식) = 검색어 없음 + 메뉴 목록 안 염. 그 외엔 검색 결과 화면 배치
  const hero = showHome && !g.listMode;
  const openMenuList = (mode: ListMode) => { g.onInput(''); void g.openList(mode); };
  const menuItems: AppsMenuItem[] = [
    // 맨 앞 = 반대편 흐름(재고 앱에선 맞춤 추천, 소믈리에 메뉴에선 재고 검색)
    { key: 'quiz', label: '맞춤 추천', sub: '취향 문답', icon: MenuIcons.sommelier, onClick: goQuiz },
    { key: 'mine', label: '매장 재고', sub: g.summary ? `${fmt(g.summary.my_items)}종` : undefined, icon: MenuIcons.stock, active: g.listMode === 'mine', onClick: () => openMenuList('mine') },
    { key: 'incoming', label: '입고 예정', sub: g.summary ? `${fmt(g.summary.incoming_items)}종` : undefined, icon: MenuIcons.incoming, active: g.listMode === 'incoming', onClick: () => openMenuList('incoming') },
    ...(g.summary && g.summary.recent_arrivals.length > 0
      ? [{ key: 'arrivals', label: '금주 입고', sub: `${g.summary.recent_arrivals.length}종`, icon: MenuIcons.arrivals, active: g.listMode === 'arrivals', onClick: () => openMenuList('arrivals') }]
      : []),
    { key: 'alerts', label: '입고 알림', sub: restock.arrived.length ? `입고 ${restock.arrived.length}건` : restock.waiting.length ? `대기 ${restock.waiting.length}건` : undefined, icon: MenuIcons.alerts, dot: restock.tileDot, onClick: openAlerts },
    { key: 'store', label: '매장 변경', icon: MenuIcons.store, onClick: () => g.setStoreKey('' as StoreKey) },
    { key: 'logout', label: '로그아웃', icon: MenuIcons.logout, onClick: () => void logoutStoreApp() },
  ];

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px calc(96px + env(safe-area-inset-bottom))' }}>
      {/* 헤더 — 오른쪽: 매장명 + 메뉴(⋮⋮⋮). 왼쪽 작은 워드마크(탭=매장 앱 메인)는 검색 화면에서만 */}
      <header style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, minHeight: 40 }}>
        <h1 style={{ margin: 0, flex: 'none', whiteSpace: 'nowrap', opacity: hero ? 0 : 1, visibility: hero ? 'hidden' : 'visible', transition: `opacity ${EASE}, visibility ${EASE}` }}>
          <button onClick={goMain} aria-label="매장 앱 메인으로" tabIndex={hero ? -1 : 0}
            style={{ all: 'unset', cursor: 'pointer', ...LAT, fontSize: 15, color: GOLD }}>
            CAVE DE VIN
          </button>
        </h1>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <GuestBadge sep />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
            {storeLabel}
          </span>
          <AppsMenuButton open={menuOpen} onToggle={() => setMenuOpen((v) => !v)} dot={restock.tileDot} />
        </span>
        <AppsMenu open={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
      </header>
      <div style={{ height: 1, background: GOLD_LINE, margin: '10px -16px 20px', opacity: hero ? 0 : 1, transition: `opacity ${EASE}` }} />


      {/* 첫 화면 — 구글처럼 가운데 큰 워드마크. 검색 시작하면 접히며 검색창이 위로 올라간다(항상 마운트 → 입력 포커스 유지) */}
      <div aria-hidden={!hero}
        style={{
          textAlign: 'center', overflow: 'hidden',
          maxHeight: hero ? 'calc(13vh + 90px)' : 0, paddingTop: hero ? 'calc(13vh - 30px)' : 0, marginBottom: hero ? 28 : 0,
          opacity: hero ? 1 : 0, transform: hero ? 'none' : 'scale(0.92)',
          transition: `max-height ${EASE}, padding-top ${EASE}, margin-bottom ${EASE}, opacity ${EASE}, transform ${EASE}`,
        }}>
        <button onClick={goMain} aria-label="매장 앱 메인으로" tabIndex={hero ? 0 : -1}
          style={{ all: 'unset', cursor: 'pointer', ...LAT, letterSpacing: '0.32em', fontSize: 'clamp(24px, 7.5vw, 34px)', lineHeight: 1.6, color: GOLD }}>
          CAVE DE VIN
        </button>
      </div>

      <SearchBar value={g.q} onChange={g.onInput} />

      {showHome ? (
        <StoreHome
          recent={g.recent} onRecent={searchNow} onClearRecent={g.clearRecent} centered={hero}
          summary={g.summary} listMode={g.listMode} listRows={g.listRows}
          onCloseList={g.closeList}
          onArrival={searchNow} renderRow={renderRow} />
      ) : (
        <div style={{ marginTop: 8 }}>
          {g.searching && <div style={{ padding: '18px 2px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>검색 중…</div>}
          {g.error && <div style={{ padding: '14px 2px', fontSize: 13, color: 'var(--status-danger)' }}>{g.error}</div>}
          {!g.searching && g.rows && g.rows.length === 0 && (
            <div style={{ padding: '28px 2px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>검색 결과가 없습니다</div>
          )}
          {/* 매장 재고 있는 것 먼저(흰색), 그다음 본사(회색). 매장·본사·입고 모두 없는 행(다른 매장에만 있음)은 숨김 */}
          {sortByTier((g.rows || []).filter((r) =>
            (r.stores[g.storeKey] || 0) + r.hq_available + r.hq_bonded + r.incoming + r.arrival_btls > 0), g.storeKey as StoreKey).map(renderRow)}
        </div>
      )}

      {g.detail && (
        <DetailSheet row={g.detail} storeKey={g.storeKey as StoreKey} alts={g.alts} onClose={() => g.setDetail(null)}
          onNote={notes.tastingNoteSet.has(g.detail.item_no)
            ? () => void notes.openFor(g.detail!.item_no, g.detail!.item_name)
            : null}
          onAdd={g.detail.retail_price > 0 ? () => cart.add(g.detail!) : undefined} />
      )}

      {alertsOpen && (
        <RestockAlertsSheet alerts={restock.alerts} onAct={(id, action) => void restock.act(id, action)} onClose={() => setAlertsOpen(false)} />
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
          storeLabel={storeLabel} storeKey={g.storeKey}
          onQty={cart.setQty} onExtraRate={cart.setExtraRate} onExtraWon={cart.setExtraWon}
          onClear={() => { cart.clear(); setCheckoutOpen(false); }}
          onClose={() => setCheckoutOpen(false)}
          continueTo={{ label: '이어서 맞춤 추천 받기 →', onClick: goQuiz }} />
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
