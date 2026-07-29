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
  // 병샷 모드 — 진짜 누끼(위 모서리가 투명)만 띄우고, 불투명 이미지(흰 박스·통사진)는 액자로.
  // 아래 모서리는 병 그림자·반사가 걸리므로 보지 않는다. 흰 박스도 액자로 통일 —
  // 띄우면 drop-shadow가 박스 윤곽을 그려 흰 카드가 붕 떠 보인다.
  const [shotMode, setShotMode] = useState<'cut' | 'photo'>('cut');

  const classify = (img: HTMLImageElement) => {
    try {
      const cv = document.createElement('canvas');
      cv.width = 8; cv.height = 8;
      const g = cv.getContext('2d');
      if (!g) return;
      g.drawImage(img, 0, 0, 8, 8);
      const px = g.getImageData(0, 0, 8, 8).data;
      const alphaAt = (x: number, y: number) => px[(y * 8 + x) * 4 + 3];
      setShotMode(alphaAt(0, 0) < 32 && alphaAt(7, 0) < 32 ? 'cut' : 'photo');
    } catch { /* 판별 실패 시 기본(cut) 유지 */ }
  };

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
  const meta = [d?.country || r.country, d?.region || r.region, d?.grape_varieties,
    d?.alcohol ? `${String(d.alcohol).replace(/%$/, '')}%` : null].filter(Boolean).join(' · ');
  const notes: [string, string][] = d ? ([
    ['색', d.color_note], ['향', d.nose_note], ['맛', d.palate_note],
    ['페어링', d.food_pairing], ['서빙 온도', d.serving_temp],
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
        <div className={`som-detail-shot ${shotMode}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/sales/wine-img?code=${encodeURIComponent(r.item_code)}${r.img_ver ? `&v=${r.img_ver}` : ''}`}
            alt={r.name}
            onLoad={(e) => classify(e.currentTarget as HTMLImageElement)}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
        </div>
        <div className="som-cardfloor" />
        <div className="som-nm">{r.name}</div>
        {r.name_en && <div className="som-en som-lat">{r.name_en}</div>}
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
