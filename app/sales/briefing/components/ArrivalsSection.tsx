'use client';
// 통관 완료 대기 품목 섹션 — 1회성 팝업이 사라진 뒤에도 브리핑에서 재확인 (14일 유지)
// 거래처별 '문구 복사' → 출고 가능 안내(할인 적용가·출고 가능일 포함)를 카톡/문자로 바로 전달
import { useEffect, useState } from 'react';
import type { RecentArrival } from '@/app/lib/incomingRequests';
import type { Sender } from '../lib/collectionMessage';
import { buildArrivalMessage, addBusinessDays, shipDateLabelOf } from '../lib/arrivalMessage';
import { vintageFromCode } from '@/app/sales/recommend/lib/quoteImage';
import { shareOrDownloadFile } from '@/app/lib/shareFile';

const todayKST = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const rateKeyOf = (r: { client_code: string | null; client_name: string }) => r.client_code || `name:${r.client_name}`;

// 할인률 수동 조정값 보존 (localStorage) — 새로고침해도 유지, 30일 지난 항목은 정리
const EDITS_KEY = 'arrival-rate-edits';
type StoredEdits = Record<string, { v: string; t: number }>;
const loadEdits = (): Record<string, string> => {
  try {
    const all = JSON.parse(localStorage.getItem(EDITS_KEY) || '{}') as StoredEdits;
    const cutoff = Date.now() - 30 * 86400_000;
    const alive: StoredEdits = {};
    const out: Record<string, string> = {};
    for (const [k, e] of Object.entries(all)) {
      if (e && e.t >= cutoff) { alive[k] = e; out[k] = e.v; }
    }
    localStorage.setItem(EDITS_KEY, JSON.stringify(alive));
    return out;
  } catch { return {}; }
};
const saveEdit = (pk: string, v: string) => {
  try {
    const all = JSON.parse(localStorage.getItem(EDITS_KEY) || '{}') as StoredEdits;
    all[pk] = { v, t: Date.now() };
    localStorage.setItem(EDITS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
};

export function ArrivalsSection({ arrivals, sender }: { arrivals: RecentArrival[]; sender?: Sender }) {
  // 복사된 문구 미리보기 (행 키 단위 — 뭘 보냈는지 확인용)
  const [copied, setCopied] = useState<{ key: string; msg: string } | null>(null);
  // 품목 아코디언 — 기본은 품목만, 줄 클릭 시 대기 거래처 펼침
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const toggleItem = (code: string) => setOpenItems((prev) => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  // 할인률(%) 결정 순서: ①수동 입력(edits, 거래처×품목 — localStorage 보존) ②그 와인 견적 이력(quoted_rate) ③거래처 기본할인률(gradeRates)
  const [edits, setEdits] = useState<Record<string, string>>(loadEdits);
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
    const codes = [...new Set([
      ...(arrivals.flatMap((a) => a.requests).map((r) => r.client_code).filter(Boolean) as string[]),
      ...arrivals.flatMap((a) => a.past_buyers.map((b) => b.client_code)),
    ])];
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

  // (거래처×품목) 입력 표시값: 수동 입력 → 견적 이력(quotedRate) → 기본할인률
  const displayRate = (rk: string, a: RecentArrival, quotedRate: number | null | undefined): string => {
    const edit = edits[`${rk}|${a.item_code}`];
    if (edit !== undefined) return edit;
    if (typeof quotedRate === 'number' && quotedRate > 0) return String(Math.round(quotedRate * 100));
    return gradeRates[rk] ?? '';
  };
  const rateValueOf = (rk: string, a: RecentArrival): string =>
    displayRate(rk, a, a.requests.find((x) => rateKeyOf(x) === rk)?.quoted_rate);
  const toFraction = (v: string): number => {
    const pct = parseFloat(v);
    return Number.isFinite(pct) && pct > 0 ? pct / 100 : 0;
  };

  const itemPayload = (a: RecentArrival, rate: number) => ({
    itemName: a.item_name || a.item_code,
    vintage: vintageFromCode(a.item_code),
    supplyPrice: a.supply_price,
    discountRate: rate,
    shipDateLabel: shipInfoOf(a)?.label ?? null,
  });

  const doCopy = async (key: string, msg: string) => {
    try { await navigator.clipboard.writeText(msg); } catch { /* http/구형 브라우저 — 미리보기에서 수동 복사 */ }
    setCopied((prev) => (prev?.key === key ? null : { key, msg }));
  };

  // 대기 등록 거래처: 이 거래처가 기다린 품목 전부 한 통으로
  const copyMessage = async (key: string, r: { client_code: string | null; client_name: string }) => {
    const rk = rateKeyOf(r);
    const msg = buildArrivalMessage({
      clientName: r.client_name,
      items: itemsOfClient(rk).map((a) => itemPayload(a, toFraction(rateValueOf(rk, a)))),
      sender,
    });
    await doCopy(key, msg);
  };
  // 이전 빈티지 구매 거래처: 이 품목 단건 안내
  const copyBuyerMessage = async (key: string, a: RecentArrival, b: { client_code: string; client_name: string; quoted_rate: number | null }) => {
    const msg = buildArrivalMessage({
      clientName: b.client_name,
      items: [itemPayload(a, toFraction(displayRate(b.client_code, a, b.quoted_rate)))],
      variant: 'used',
      sender,
    });
    await doCopy(key, msg);
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
              {/* 가용·공급가·출고일은 헤더에서 숨김(품목명 확보) — 카톡 문구에는 그대로 포함됨 */}
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
              const key = `r${r.id}`;
              return (
                <ClientRow
                  key={key}
                  rowKey={key}
                  name={r.client_name}
                  sub={r.memo || undefined}
                  rateValue={rateValueOf(rk, a)}
                  fromQuote={edits[`${rk}|${a.item_code}`] === undefined && typeof r.quoted_rate === 'number' && r.quoted_rate > 0}
                  onRateChange={(v) => { const pk = `${rk}|${a.item_code}`; setEdits((prev) => ({ ...prev, [pk]: v })); saveEdit(pk, v); }}
                  onCopy={() => copyMessage(key, r)}
                  copyLabel={itemsOfClient(rk).length > 1 ? `💬 문구 복사 (${itemsOfClient(rk).length}종)` : '💬 문구 복사'}
                  copied={copied?.key === key ? copied.msg : null}
                />
              );
            })}
            {/* 이전 빈티지 구매 거래처 — 같은 와인 다른 빈티지의 최근 1년 출고처 (대기 미등록만). 음영 패널로 대기 등록과 구분 */}
            {open && a.past_buyers.length > 0 && (
              <div style={{ marginTop: 10, padding: '7px 10px 9px', background: 'var(--surface-muted)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>
                  이전 빈티지 구매 거래처 {a.past_buyers.length} · 최근 1년
                </div>
                {a.past_buyers.map((b) => {
                  const key = `b${a.item_code}|${b.client_code}`;
                  const pk = `${b.client_code}|${a.item_code}`;
                  return (
                    <ClientRow
                      key={key}
                      rowKey={key}
                      name={b.client_name}
                      sub={`${b.qty}병 · ${b.last_date.slice(5)}`}
                      rateValue={displayRate(b.client_code, a, b.quoted_rate)}
                      fromQuote={edits[pk] === undefined && typeof b.quoted_rate === 'number' && b.quoted_rate > 0}
                      onRateChange={(v) => { setEdits((prev) => ({ ...prev, [pk]: v })); saveEdit(pk, v); }}
                      onCopy={() => copyBuyerMessage(key, a, b)}
                      copyLabel="💬 문구 복사"
                      copied={copied?.key === key ? copied.msg : null}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 거래처 한 줄 — 줄 클릭=문구 복사+미리보기 토글, 할인 입력, 복사 버튼 (대기 등록·이전 빈티지 공용) */
function ClientRow(p: {
  rowKey: string;
  name: string;
  sub?: string;
  rateValue: string;
  fromQuote: boolean;
  onRateChange: (v: string) => void;
  onCopy: () => void;
  copyLabel: string;
  copied: string | null;
}) {
  return (
    <div>
      <div
        onClick={p.onCopy}
        style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}
      >
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.name}</span>
        {p.sub && <span style={{ color: 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{p.sub}</span>}
        <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', cursor: 'default' }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>할인</span>
          <input
            type="number"
            min={0}
            max={99}
            value={p.rateValue}
            placeholder="0"
            onChange={(e) => p.onRateChange(e.target.value)}
            title={p.fromQuote ? '이 거래처에 이 와인을 견적한 이력의 할인률' : '거래처 기본할인률 (수정 가능)'}
            style={{ width: 44, padding: '3px 6px', fontSize: 12, textAlign: 'right', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface)', color: p.fromQuote ? 'var(--status-info)' : 'var(--text-primary)', fontWeight: p.fromQuote ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}
            aria-label={`${p.name} 할인률(%)`}
          />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>%</span>
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); p.onCopy(); }}
          style={{ width: 112, padding: '3px 0', fontSize: 11, fontWeight: 700, borderRadius: 6, border: '1px solid var(--action)', background: 'var(--surface)', color: 'var(--action)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
        >
          {p.copied ? '✓ 복사됨' : p.copyLabel}
        </button>
      </div>
      {p.copied && (
        <div style={{ marginTop: 6, padding: '8px 10px', fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)', background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 8, whiteSpace: 'pre-wrap', userSelect: 'all' }}>
          {p.copied}
        </div>
      )}
    </div>
  );
}
