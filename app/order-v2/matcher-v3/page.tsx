'use client';

// 매처 v3 테스트 — v2(현행 가중치)와 v3(임베딩→신호→판정)를 라인별로 나란히 비교.
import type { CSSProperties } from 'react';
import { useMatcherTest, type CompareRow } from './useMatcherTest';

const won3 = (n: number) => n.toFixed(3);
const dot = (c: string): CSSProperties => ({ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: c, marginRight: 6, verticalAlign: 1 });

export default function MatcherV3TestPage() {
  const { text, setText, clientCode, setClientCode, rows, client, ranWithCode, loading, err, run } = useMatcherTest();
  const agreeCount = rows?.filter((r) => r.agree).length ?? 0;

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '28px 20px 80px', color: 'var(--text-primary)' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 500, margin: '0 0 4px' }}>매처 v3 테스트</h1>
      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '0 0 18px', wordBreak: 'keep-all' }}>
        v2 = 현행 가중치 매칭 · v3 = 임베딩 검색 → 이력/빈티지 신호 → 마진/LLM 판정. 라인당 한 와인.
      </p>

      <textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={6}
        placeholder={'발주 라인 (줄당 1개, 최대 20)\n예)\n지라르댕 뫼르소 레끌루 22빈\n샤블리 그르누이\n누나 말벡'}
        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 16, borderRadius: 10, border: '1px solid var(--border-default)', resize: 'vertical', background: 'var(--surface)' }}
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={clientCode} onChange={(e) => setClientCode(e.target.value)}
          placeholder="거래처 코드 (선택 — 이력 신호)"
          style={{ flex: '0 1 220px', padding: '10px 12px', fontSize: 16, borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--surface)' }}
        />
        <button onClick={run} disabled={loading}
          style={{ padding: '11px 22px', fontSize: 14, fontWeight: 700, background: 'var(--action)', color: '#fff', border: 'none', borderRadius: 10, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? '매칭 중…' : '비교 실행'}
        </button>
        {rows && (
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            일치 {agreeCount}/{rows.length}
          </span>
        )}
      </div>
      {/* 거래처 인식 여부 — 이력 신호가 실제로 붙었는지 확인용 */}
      {rows && ranWithCode && (
        client ? (
          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--status-success)' }}>
            <i style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)', marginRight: 6, verticalAlign: 1 }} />
            거래처 인식: {client.name} ({client.code}) · 출고 이력 {client.historyItems.toLocaleString()}건 반영
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--status-warning)' }}>
            거래처 코드를 찾지 못했습니다 — 이력 신호 없이 매칭했어요. (코드 숫자를 확인하세요)
          </div>
        )
      )}
      {err && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--status-danger)' }}>{err}</div>}

      {rows?.map((r) => <ResultRow key={r.line} r={r} />)}
    </div>
  );
}

function ResultRow({ r }: { r: CompareRow }) {
  const v3 = r.v3;
  const t = v3.timingMs;
  return (
    <div style={{ marginTop: 26, borderTop: '1px solid var(--border-default)', paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{r.line}</span>
        <span style={{ fontSize: 12, color: r.agree ? 'var(--status-success)' : 'var(--status-warning)' }}>
          {r.agree ? '두 버전 일치' : '결과 다름'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          임베딩 {t.embed}ms · 검색 {t.retrieve}ms · 판정 {t.decide}ms ({v3.decidedBy})
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 10 }}>
        {/* v2 */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>V2 · 현행</div>
          {r.v2?.item_no ? (
            <div style={{ fontSize: 13.5 }}>
              <span style={dot('var(--status-info)')} />{r.v2.item_name}
              <span style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {r.v2.item_no} · {r.v2.score != null ? won3(r.v2.score) : '-'}
              </span>
            </div>
          ) : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>미해결</div>}
          {(r.v2?.candidates || []).slice(1, 4).map((c) => (
            <div key={c.item_no} style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {c.item_name} · {won3(c.score)}
            </div>
          ))}
        </div>

        {/* v3 */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
            V3 · 임베딩{v3.reason ? ` — ${v3.reason}` : ''}
          </div>
          {v3.picked ? (
            <div style={{ fontSize: 13.5 }}>
              <span style={dot('var(--status-success)')} />{v3.picked.item_name}
              <span style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {v3.picked.item_no} · 확신 {won3(v3.confidence)}
              </span>
            </div>
          ) : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>미해결</div>}
          {v3.candidates.filter((c) => c.item_no !== v3.picked?.item_no).slice(0, 3).map((c) => (
            <div key={c.item_no} style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {c.item_name} · {c.lexical >= c.similarity ? `어휘 ${won3(c.lexical)}` : `유사 ${won3(c.similarity)}`}{c.in_history ? ' · 이력' : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
