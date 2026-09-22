'use client';

// 발주 v3 — 임베딩 매처 기반. 와인(CDV) 전용.
// 구성: v2(긴 폼 한 장)와 달리 실제 업무 리듬대로 3단계 플로우 — ① 입력 → ② 검토 → ③ 전송.
// 주 액션은 항상 하단 고정 바(엄지 존). 모바일 우선(375px), KREAM 문법.
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ImageIntakeButton } from '@/app/order-v2/components/ImageIntakeButton';
import { DELIVERY_PRESETS } from '@/app/order-v2/constants';
import { ClientSection } from './components/ClientSection';
import { LineRow } from './components/LineRow';
import { MessagePanel } from './components/MessagePanel';
import { useOrderV3Page } from './hooks/useOrderV3Page';

const fmt = (n: number) => n.toLocaleString('ko-KR');
type Step = 'input' | 'review' | 'send';
const STEPS: { key: Step; label: string }[] = [
  { key: 'input', label: '입력' }, { key: 'review', label: '검토' }, { key: 'send', label: '전송' },
];

export default function OrderV3Page() {
  // 훅 결과는 전부 구조분해 — ref를 품은 객체를 멤버 접근하면 react-compiler 린트에 걸린다 (v2 page와 동일 패턴)
  const {
    client, history, delivery, wineSearch,
    orderText, setOrderText, orderTextRef, pasteFromClipboard,
    lines, historySet, loading, error, parse, reset,
    setQty, removeLine, selectCandidate, replaceWithSearch, addLineFromHistory,
    expanded, toggleExpand, discountRates, setDiscount,
    deliveryNotes, setDeliveryNotes, finalDeliveryLabel, paymentFirst,
    staffMessage, clientMessage, copied, copy, totalAmount,
    imageIntake, handleFiles,
  } = useOrderV3Page();

  const [step, setStep] = useState<Step>('input');
  const [msgTab, setMsgTab] = useState<'staff' | 'client'>('staff'); // 전송 단계 탭 — 하단 복사 버튼과 동기
  const [showOriginal, setShowOriginal] = useState(false); // 라인별 원문 표시가 기본 — 전체 원문은 누락 대조용(접힘)
  const totalQty = lines.reduce((a, l) => a + l.quantity, 0);
  const unresolved = lines.filter((l) => l.selectedIdx < 0).length;

  // 분석 완료 → 미확정 0이면 검토 건너뛰고 전송 직행(+직원용 자동 복사), 미확정 있으면 검토로
  useEffect(() => {
    if (loading || lines.length === 0 || step !== 'input') return;
    if (lines.every((l) => l.selectedIdx >= 0)) {
      setStep('send'); setMsgTab('staff'); void copy('staff');
    } else {
      setStep('review');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, lines.length]);

  const goReset = () => { reset(); setStep('input'); };

  const clientSection = (onPick: (it: Parameters<typeof addLineFromHistory>[0]) => void) => (
    <ClientSection
      query={client.query} setQuery={client.setQuery}
      results={client.results} selected={client.selected} setSelected={client.setSelected}
      showDropdown={client.showDropdown} setShowDropdown={client.setShowDropdown}
      pick={client.pick} dropdownRef={client.dropdownRef}
      historyItems={history.items} historyLoading={history.loading}
      historyShow={history.show} historyToggle={history.toggle}
      onPickHistoryItem={onPick}
    />
  );

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 120px', color: 'var(--text-primary)' }}>
      {/* 헤더 + 단계 표시 */}
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, margin: 0 }}>발주</h1>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>v3 베타 · 와인 전용</span>
        <a href="/order-v2" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>글라스·배치는 v2 →</a>
      </header>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '16px 0 22px', borderBottom: '1px solid var(--border-default)' }}>
        {STEPS.map((s, i) => {
          const active = step === s.key;
          const reachable = s.key === 'input' || lines.length > 0;
          return (
            <button key={s.key} onClick={() => reachable && setStep(s.key)}
              style={{
                all: 'unset', cursor: reachable ? 'pointer' : 'default',
                padding: '10px 16px 9px', fontSize: 13.5,
                fontWeight: active ? 700 : 400,
                color: active ? 'var(--text-primary)' : reachable ? 'var(--text-tertiary)' : 'var(--text-muted)',
                borderBottom: active ? '2px solid var(--action)' : '2px solid transparent',
                marginBottom: -1,
              }}>
              <span style={{ fontVariantNumeric: 'tabular-nums', marginRight: 5, fontSize: 11.5 }}>{i + 1}</span>
              {s.label}
            </button>
          );
        })}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'baseline', gap: 12, whiteSpace: 'nowrap' }}>
          {lines.length > 0 && (
            <span style={{ fontSize: 12, color: unresolved > 0 ? 'var(--status-warning)' : 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
              {unresolved > 0 ? `미확정 ${unresolved}` : `${lines.length}종 · ${fmt(totalQty)}병`}
            </span>
          )}
          {(lines.length > 0 || orderText.trim()) && (
            <button
              onClick={() => { if (lines.length === 0 || confirm('발주 내용을 모두 지우고 새로 시작할까요?')) goReset(); }}
              style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 2px' }}>
              초기화
            </button>
          )}
        </span>
      </nav>

      {/* ── ① 입력 ── */}
      {step === 'input' && (
        <section>
          <ImageIntakeButton
            loading={imageIntake.loading}
            error={imageIntake.error}
            onFiles={handleFiles}
            onClearError={imageIntake.clearError}
          />
          <div style={{ margin: '14px 0' }}>
            {clientSection((it) => { addLineFromHistory(it); setStep('review'); })}
          </div>
          <textarea
            ref={orderTextRef}
            value={orderText}
            onChange={(e) => setOrderText(e.target.value)}
            rows={8}
            placeholder={'발주 원문을 그대로 붙여넣으세요\n\n인사말·요청사항은 자동으로 걸러지고\n오타·구매이력·재고를 반영해 매칭합니다'}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '14px', fontSize: 16, lineHeight: 1.65,
              border: '1px solid var(--border-default)', borderRadius: 12, resize: 'vertical',
              outline: 'none', background: 'var(--surface)',
            }}
          />
          {error && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--status-danger)' }}>{error}</div>}
        </section>
      )}

      {/* ── ② 검토 ── */}
      {step === 'review' && lines.length > 0 && (
        <section>
          {/* 발주 원문 — 추출 누락·수량 오인 대조용. 접기 가능 */}
          {orderText.trim() && (
            <div style={{ marginBottom: 14 }}>
              <button onClick={() => setShowOriginal((v) => !v)}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 6, padding: '2px 2px 6px', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>발주 원문</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{showOriginal ? '접기 ▴' : '펼치기 ▾'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>빠진 라인이 없는지 확인</span>
              </button>
              {showOriginal && (
                <pre style={{
                  margin: 0, padding: '10px 12px', fontSize: 13, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
                  color: 'var(--text-secondary)', background: 'var(--surface-muted)',
                  borderRadius: 10, maxHeight: 180, overflowY: 'auto',
                }}>
                  {orderText}
                </pre>
              )}
            </div>
          )}
          <div style={{ display: 'flex', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
            {[
              ['품목', `${lines.length}종`],
              ['수량', `${fmt(totalQty)}병`],
              ['공급가 합계', totalAmount > 0 ? fmt(totalAmount) : '—'],
            ].map(([k, v], i) => (
              <div key={k} style={{ flex: 1, textAlign: 'center', padding: '12px 4px', borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none', minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{k}</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4 }}>
            {lines.map((line, idx) => (
              <LineRow
                key={`${line.query}-${idx}`}
                line={line}
                expanded={expanded.has(idx) || line.selectedIdx < 0}
                historySet={historySet}
                discount={discountRates[idx] || 0}
                isSearching={wineSearch.idx === idx}
                searchQuery={wineSearch.query}
                setSearchQuery={wineSearch.setQuery}
                searchResults={wineSearch.results}
                searchLoading={wineSearch.loading}
                searchRef={wineSearch.ref}
                onOpenSearch={() => { wineSearch.setIdx(idx); wineSearch.setQuery(''); }}
                onToggle={() => toggleExpand(idx)}
                onQty={(q) => setQty(idx, q)}
                onRemove={() => removeLine(idx)}
                onSelect={(c) => selectCandidate(idx, c)}
                onPickSearch={(w) => replaceWithSearch(idx, w)}
                onDiscount={(r) => setDiscount(idx, r)}
              />
            ))}
          </div>

          {/* 입고내역에서 라인 추가 */}
          <div style={{ marginTop: 14 }}>
            {clientSection(addLineFromHistory)}
          </div>
        </section>
      )}

      {/* ── ③ 전송 ── */}
      {step === 'send' && lines.length > 0 && (
        <section>
          {/* 자동 직행 시 검토 요약 한 줄 — 문제 없었음을 알리고 복귀 동선 제공 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 2px 12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--status-success)' }}>
              ● {lines.length}종 전체 확정 · {fmt(totalQty)}병
            </span>
            <button onClick={() => setStep('review')}
              style={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-tertiary)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              품목 검토하기
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px 12px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', flex: 'none' }}>배송 예정일</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
              {finalDeliveryLabel || '—'}
            </span>
            {paymentFirst && (
              <span style={{ fontSize: 11.5, color: 'var(--status-warning)', flex: 'none' }}>입금확인 · 영업일 +2 자동</span>
            )}
            {delivery.info?.isFriday && (
              <span style={{ display: 'inline-flex', gap: 6, flex: 'none' }}>
                {(['sat', 'mon'] as const).map((c) => (
                  <button key={c} onClick={() => delivery.setFridayChoice(c)}
                    style={{
                      all: 'unset', cursor: 'pointer', fontSize: 12, padding: '3px 8px', borderRadius: 7,
                      border: `1px solid ${delivery.fridayChoice === c ? 'var(--action)' : 'var(--border-default)'}`,
                      fontWeight: delivery.fridayChoice === c ? 700 : 400,
                    }}>
                    {c === 'sat' ? '토요일' : '월요일'}
                  </button>
                ))}
              </span>
            )}
            <input
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="특이사항 (선택)"
              style={{
                flex: '1 1 160px', minWidth: 120, padding: '8px 10px', fontSize: 16,
                border: '1px solid var(--border-subtle)', borderRadius: 8, outline: 'none', background: 'var(--surface)',
              }}
            />
          </div>
          {/* 특이사항 프리셋 드롭다운 — 선택하면 추가, 이미 있는 문구를 다시 선택하면 제거 */}
          <div style={{ padding: '10px 2px 0' }}>
            <select
              value=""
              onChange={(e) => {
                const preset = e.target.value;
                if (!preset) return;
                const on = deliveryNotes.includes(preset);
                setDeliveryNotes(on
                  ? deliveryNotes.split('\n').filter((l) => l.trim() !== preset).join('\n')
                  : deliveryNotes.trim() ? `${deliveryNotes}\n${preset}` : preset);
              }}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 16,
                border: '1px solid var(--border-default)', borderRadius: 10,
                background: 'var(--surface)', color: 'var(--text-secondary)',
              }}>
              <option value="">자주 쓰는 특이사항 선택…</option>
              {DELIVERY_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {deliveryNotes.includes(preset) ? `✓ ${preset} (선택 해제)` : preset}
                </option>
              ))}
            </select>
          </div>
          <MessagePanel
            staffMessage={staffMessage}
            clientMessage={clientMessage}
            copied={copied}
            onCopy={copy}
            which={msgTab}
            setWhich={(w) => { setMsgTab(w); void copy(w); }}
          />
        </section>
      )}

      {/* ── 하단 고정 액션 바 (엄지 존) ──
          데스크탑 사이드바(232px, 접힘 60px)가 main을 밀어내므로 fixed 바도 같은 만큼 밀어 본문과 센터를 맞춘다 */}
      <style>{`
        .ov3-fixedbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; }
        @media (min-width: 1024px) {
          .ov3-fixedbar { left: 232px; transition: left 0.18s ease; }
          body.cdv-sidebar-collapsed .ov3-fixedbar { left: 60px; }
        }
      `}</style>
      <div className="ov3-fixedbar" style={{
        background: 'var(--surface)', borderTop: '1px solid var(--border-default)',
        padding: '10px 16px calc(10px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', gap: 8 }}>
          {step === 'input' && (
            <>
              <button onClick={pasteFromClipboard} style={btnGhost}>붙여넣기</button>
              <button onClick={() => parse()} disabled={loading || !orderText.trim()}
                style={{ ...btnPrimary, opacity: loading || !orderText.trim() ? 0.45 : 1 }}>
                {loading ? '분석 중…' : '발주 분석'}
              </button>
            </>
          )}
          {step === 'review' && (
            <>
              <button onClick={() => setStep('input')} style={btnGhost}>← 입력</button>
              <button
                onClick={() => { setStep('send'); setMsgTab('staff'); void copy('staff'); }}
                disabled={lines.length === 0}
                style={{ ...btnPrimary, opacity: lines.length === 0 ? 0.45 : 1 }}>
                {unresolved > 0 ? `메시지 만들기 (미확정 ${unresolved})` : '메시지 만들기'}
              </button>
            </>
          )}
          {step === 'send' && (
            <>
              <button onClick={() => setStep('review')} style={btnGhost}>← 검토</button>
              <button onClick={() => copy(msgTab)} style={{ ...btnPrimary, background: copied === msgTab ? 'var(--status-success)' : 'var(--action)' }}>
                {copied === msgTab ? '복사됨 ✓' : msgTab === 'staff' ? '직원용 발주 복사' : '거래처 메시지 복사'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const btnPrimary: CSSProperties = {
  flex: 1, padding: '14px 0', fontSize: 15, fontWeight: 700, background: 'var(--action)',
  color: '#fff', border: 'none', borderRadius: 11, cursor: 'pointer',
};
const btnGhost: CSSProperties = {
  flex: 'none', padding: '14px 18px', fontSize: 13.5, fontWeight: 600, background: 'var(--surface)',
  color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 11, cursor: 'pointer',
};
