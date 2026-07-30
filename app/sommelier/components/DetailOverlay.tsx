'use client';

// 결과 카드 → 전체화면 상세. 카드가 확장되듯 떠오르고, 병샷·구조 바에
// 테이스팅 노트(색·향·맛·페어링·서빙 온도)와 품종·산지가 더해진다.
import { useEffect, useState } from 'react';
import type { SommelierResult } from '@/app/lib/sommelierRecommend';
import type { SommelierDetail } from '@/app/lib/sommelierDetail';

const won = (n: number) => n.toLocaleString('ko-KR');

export function DetailOverlay({ r, rank, ordered, busy, onOrder, onClose }: {
  r: SommelierResult;
  rank: string;
  ordered: boolean;
  busy: boolean;
  onOrder: () => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<SommelierDetail | null>(null);
  const [out, setOut] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/sommelier/detail?code=${encodeURIComponent(r.item_code)}`)
      .then((rs) => rs.json())
      .then((j) => { if (alive) setD(j.detail || ({} as SommelierDetail)); })
      .catch(() => { if (alive) setD({} as SommelierDetail); });
    return () => { alive = false; };
  }, [r.item_code]);

  const close = () => { if (out) return; setOut(true); setTimeout(onClose, 360); };

  const flavors = (d?.flavors?.length ? d.flavors : r.flavors) || [];
  // 빈티지는 와인명 앞에 붙으므로 메타 줄에서는 제외
  const meta = [d?.country || r.country, d?.region || r.region, d?.grape_varieties,
    d?.alcohol ? `${String(d.alcohol).replace(/%$/, '')}%` : null].filter(Boolean).join(' · ');
  // 색·향·맛 서술은 위 향미 키워드가 대신 — 여기는 와이너리·양조·빈티지 이야기
  const notes: [string, string][] = d ? ([
    ['와이너리', d.winery_description], ['양조', d.winemaking], ['빈티지', d.vintage_note],
    ['숙성', d.aging_potential], ['페어링', d.food_pairing], ['서빙 온도', d.serving_temp],
  ] as [string, string | null][]).filter((row): row is [string, string] => !!row[1]) : [];

  return (
    // 화면 아무 곳이나 다시 탭하면 닫기 (버튼은 전파 차단)
    <div className={`som-detail${out ? ' out' : ''}`} role="dialog" aria-modal="true" onClick={close}>
      <div className="som-detail-top">
        <button className="som-detail-back" onClick={close}>← 추천 목록</button>
        <span className="som-lat">NO. {rank}</span>
      </div>
      <div className="som-detail-body">
        <div className="som-detail-card">
        <div className="som-detail-core">
        <div className="som-detail-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/sales/wine-img?code=${encodeURIComponent(r.item_code)}${r.img_ver ? `&v=${r.img_ver}` : ''}`}
            alt={r.name}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
        </div>
        <div className="som-cardfloor" />
        <div className="som-nm">{[r.vintage, r.name].filter(Boolean).join(' ')}</div>
        {r.name_en && <div className="som-en som-lat">{[r.vintage, r.name_en].filter(Boolean).join(' ')}</div>}
        {meta && <div className="som-detail-meta">{meta}</div>}

        <div className="som-bars som-detail-bars">
          <div className="som-bar"><b>무게감</b><div className="tr"><i style={{ ['--v' as string]: r.body }} /></div></div>
          <div className="som-bar"><b>당도</b><div className="tr"><i style={{ ['--v' as string]: r.sweetness }} /></div></div>
          <div className="som-bar"><b>산미</b><div className="tr"><i style={{ ['--v' as string]: r.acidity }} /></div></div>
          <div className="som-bar"><b>탄닌</b><div className="tr"><i style={{ ['--v' as string]: r.tannin }} /></div></div>
        </div>

        {flavors.length > 0 && (
          <div className="som-detail-fl">
            {flavors.map((f) => <span key={f}><i />{f}</span>)}
          </div>
        )}

        {d === null ? (
          <div className="som-detail-wait">테이스팅 노트를 여는 중…</div>
        ) : notes.length === 0 ? (
          <div className="som-detail-wait">상세 테이스팅 노트를 준비 중인 와인입니다</div>
        ) : (
          <dl className="som-detail-notes">
            {notes.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        )}

        <div className="som-pricebox">
          <span className="som-price">{won(r.retail_price)}원</span>
          <button className={`som-buy${ordered ? ' done' : ''}`}
            onClick={(e) => { e.stopPropagation(); onOrder(); }} disabled={busy}
            title={ordered ? '다시 누르면 취소됩니다' : undefined}>
            {busy ? '처리 중…' : ordered ? '✓ 기록됨 · 취소' : '구매 기록'}
          </button>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}
