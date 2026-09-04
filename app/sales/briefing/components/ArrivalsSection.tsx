'use client';
// 통관 완료 대기 품목 섹션 — 1회성 팝업이 사라진 뒤에도 브리핑에서 재확인 (14일 유지)
// 거래처별 '문구 복사' → 출고 가능 안내(할인 적용가·출고 가능일 포함)를 카톡/문자로 바로 전달
import { useEffect, useState } from 'react';
import type { RecentArrival } from '@/app/lib/incomingRequests';
import type { Sender } from '../lib/collectionMessage';
import { buildArrivalMessage, addBusinessDays, shipDateLabelOf } from '../lib/arrivalMessage';
import { vintageFromCode } from '@/app/sales/recommend/lib/quoteImage';
import { shareOrDownloadFile } from '@/app/lib/shareFile';

const fmt = (n: number) => n.toLocaleString();
const todayKST = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
// 헤더용 짧은 날짜 (9/7(월)) — 문구에는 긴 형태(9월 7일(월)) 유지
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${'일월화수목금토'[d.getUTCDay()]})`;
};
const rateKeyOf = (r: { client_code: string | null; client_name: string }) => r.client_code || `name:${r.client_name}`;

export function ArrivalsSection({ arrivals, sender }: { arrivals: RecentArrival[]; sender?: Sender }) {
  // 복사된 문구 미리보기 (request id 단위 — 뭘 보냈는지 확인용)
  const [copied, setCopied] = useState<{ id: number; msg: string } | null>(null);
  // 품목 아코디언 — 기본은 품목만, 줄 클릭 시 대기 거래처 펼침
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const toggleItem = (code: string) => setOpenItems((prev) => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  // 할인률(%) 결정 순서: ①수동 입력(edits, 거래처×품목) ②그 와인 견적 이력(quoted_rate) ③거래처 기본할인률(gradeRates)
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [gradeRates, setGradeRates] = useState<Record<string, string>>({});
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  // 테이스팅 노트 다운로드 상태 (품목 단위): loading | none(노트 없음)
  const [noteState, setNoteState] = useState<Record<string, 'loading' | 'none'>>({});

  const downloadNote = async (a: RecentArrival) => {
    if (noteState[a.item_code] === 'loading') return;
    setNoteState((prev) => ({ ...prev, [a.item_code]: 'loading' }));
    try {
      const res = await fetch(`/api/tasting-notes/pdf?item_code=${encodeURIComponent(a.item_code)}`, { credentials: 'include' });
      if (!res.ok) {
        setNoteState((prev) => ({ ...prev, [a.item_code]: 'none' }));
        return;
      }
      const blob = await res.blob();
      await shareOrDownloadFile(blob, `테이스팅노트_${a.item_name || a.item_code}.pdf`, 'application/pdf');
      setNoteState((prev) => { const rest = { ...prev }; delete rest[a.item_code]; return rest; });
    } catch {
      setNoteState((prev) => ({ ...prev, [a.item_code]: 'none' }));
    }
  };

  // 공휴일 (올해+내년 — 연말 통관 대비) → 출고 가능일 계산용
  useEffect(() => {
    const y = new Date().getFullYear();
    Promise.all([y, y + 1].map((yy) =>
      fetch(`/api/sales/holidays?year=${yy}`).then((r) => r.json()).catch(() => null)))
      .then((ds) => {
        const set = new Set<string>();
        for (const d of ds) for (const k of Object.keys(d?.holidays || {})) set.add(k);
        setHolidays(set);
      });
  }, []);

  // 거래처 기본할인률 로드 — 견적 이력이 없는 (거래처×품목)의 기본값
  useEffect(() => {
    const codes = [...new Set(
      arrivals.flatMap((a) => a.requests).map((r) => r.client_code).filter(Boolean) as string[],
    )];
    for (const code of codes) {
      if (gradeRates[code] !== undefined) continue;
      fetch(`/api/sales/clients/grade?client_code=${encodeURIComponent(code)}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          if (typeof d?.benefit?.rate === 'number') {
            setGradeRates((prev) => (prev[code] !== undefined ? prev : { ...prev, [code]: String(Math.round(d.benefit.rate * 100)) }));
          }
        })
        .catch(() => { /* 기본할인률 조회 실패 → 수동 입력 */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivals]);

  if (arrivals.length === 0) return null;
  const newCount = arrivals.filter((a) => !a.notified_at).length;
  const today = todayKST();

  // 출고 가능일 = 통관일(팝업 확인일, 미확인이면 오늘) + 영업일 2일. 이미 지났으면 바로 출고.
  const shipInfoOf = (a: RecentArrival): { iso: string; label: string } | null => {
    const cleared = a.notified_at ? a.notified_at.slice(0, 10) : today;
    const iso = addBusinessDays(cleared, 2, holidays);
    return iso <= today ? null : { iso, label: shipDateLabelOf(iso) };
  };

  // 이 거래처가 기다린 통관 품목 전부 (여러 품목에 걸려 있으면 한 통으로 통합)
  const itemsOfClient = (rk: string): RecentArrival[] =>
    arrivals.filter((a) => a.requests.some((q) => rateKeyOf(q) === rk));

  // (거래처×품목) 입력 표시값: 수동 입력 → 견적 이력 → 기본할인률
  const rateValueOf = (rk: string, a: RecentArrival): string => {
    const edit = edits[`${rk}|${a.item_code}`];
    if (edit !== undefined) return edit;
    const q = a.requests.find((x) => rateKeyOf(x) === rk)?.quoted_rate;
    if (typeof q === 'number' && q > 0) return String(Math.round(q * 100));
    return gradeRates[rk] ?? '';
  };
  const rateFractionOf = (rk: string, a: RecentArrival): number => {
    const pct = parseFloat(rateValueOf(rk, a));
    return Number.isFinite(pct) && pct > 0 ? pct / 100 : 0;
  };

  const copyMessage = async (id: number, r: { client_code: string | null; client_name: string }) => {
    const rk = rateKeyOf(r);
    const msg = buildArrivalMessage({
      clientName: r.client_name,
      items: itemsOfClient(rk).map((a) => ({
        itemName: a.item_name || a.item_code,
        vintage: vintageFromCode(a.item_code),
        supplyPrice: a.supply_price,
        discountRate: rateFractionOf(rk, a),
        shipDateLabel: shipInfoOf(a)?.label ?? null,
      })),
      sender,
    });
    try { await navigator.clipboard.writeText(msg); } catch { /* http/구형 브라우저 — 미리보기에서 수동 복사 */ }
    setCopied((prev) => (prev?.id === id ? null : { id, msg }));
  };

  return (
    <div style={{ marginBottom: 12, background: '#fff', border: '1px solid var(--border-default)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: 'var(--surface-muted)', borderBottom: '1px solid var(--action-muted)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span>통관 완료 — 대기 품목</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
          {arrivals.length}종
          {newCount > 0 && <span style={{ color: 'var(--status-success)', fontWeight: 700 }}> · 미확인 {newCount}</span>}
          <span> · 최근 14일</span>
        </span>
      </div>
      {arrivals.map((a) => {
        const ship = shipInfoOf(a);
        const open = openItems.has(a.item_code);
        return (
          <div key={a.item_code} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            {/* 품목 줄 클릭 → 대기 거래처 펼침/접힘. 한 줄 고정 — 품목명만 말줄임, 메타는 nowrap 압축 */}
            <div onClick={() => toggleItem(a.item_code)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}>
              <span style={{ flex: 1, minWidth: 60, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.item_name || a.item_code}
              </span>
              {!a.notified_at && (
                <span style={{ flex: 'none', fontSize: 9, fontWeight: 800, color: '#fff', background: 'var(--status-success)', borderRadius: 4, padding: '1px 4px', letterSpacing: 0.3 }}>NEW</span>
              )}
              <span style={{ flex: 'none', fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                거래처 {a.requests.length}
                <span style={{ display: 'inline-block', marginLeft: 3, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
              </span>
              <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: 'var(--status-success)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                가용 {fmt(a.available)}병
              </span>
              {a.supply_price > 0 && (
                <span style={{ flex: 'none', fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {fmt(a.supply_price)}원
                </span>
              )}
              <span style={{ flex: 'none', fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {ship ? `출고 ${shortDate(ship.iso)}~` : '바로 출고'}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); downloadNote(a); }}
                disabled={noteState[a.item_code] === 'loading'}
                title="테이스팅 노트 PDF — 모바일은 공유 시트로 카톡 전송"
                style={{ padding: '3px 9px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: '1px solid var(--border-strong, var(--border-default))', background: 'var(--surface)', color: noteState[a.item_code] === 'none' ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: noteState[a.item_code] === 'loading' ? 'default' : 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
              >
                {noteState[a.item_code] === 'loading' ? '…' : noteState[a.item_code] === 'none' ? '노트 없음' : '노트'}
              </button>
            </div>
            {open && a.requests.map((r) => {
              const rk = rateKeyOf(r);
              const pk = `${rk}|${a.item_code}`;
              const fromQuote = edits[pk] === undefined && typeof r.quoted_rate === 'number' && r.quoted_rate > 0;
              return (
                <div key={r.id}>
                  {/* 줄 전체가 클릭 영역 — 누르면 문구 복사 + 미리보기 토글 (입력/버튼 클릭은 제외) */}
                  <div
                    onClick={() => copyMessage(r.id, r)}
                    style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}
                  >
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{r.client_name}</span>
                    {r.memo && <span style={{ color: 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.memo}</span>}
                    <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', cursor: 'default' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>할인</span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={rateValueOf(rk, a)}
                        placeholder="0"
                        onChange={(e) => setEdits((prev) => ({ ...prev, [pk]: e.target.value }))}
                        title={fromQuote ? '이 거래처에 이 와인을 견적한 이력의 할인률' : '거래처 기본할인률 (수정 가능)'}
                        style={{ width: 44, padding: '3px 6px', fontSize: 12, textAlign: 'right', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface)', color: fromQuote ? 'var(--status-info)' : 'var(--text-primary)', fontWeight: fromQuote ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}
                        aria-label={`${r.client_name} 할인률(%)`}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>%</span>
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyMessage(r.id, r); }}
                      style={{ width: 112, padding: '3px 0', fontSize: 11, fontWeight: 700, borderRadius: 6, border: '1px solid var(--action)', background: 'var(--surface)', color: 'var(--action)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
                    >
                      {copied?.id === r.id ? '✓ 복사됨'
                        : itemsOfClient(rk).length > 1 ? `💬 문구 복사 (${itemsOfClient(rk).length}종)` : '💬 문구 복사'}
                    </button>
                  </div>
                  {copied?.id === r.id && (
                    <div style={{ marginTop: 6, padding: '8px 10px', fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)', background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', borderRadius: 8, whiteSpace: 'pre-wrap', userSelect: 'all' }}>
                      {copied.msg}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
