// 매장 앱 공용 브랜드 문법 — 소믈리에와 같은 Didot 라틴 워드마크 + 골드 헤어라인.
import type { CSSProperties } from 'react';

export const fmt = (n: number) => n.toLocaleString('ko-KR');

export const LAT: CSSProperties = { fontFamily: 'Didot, "Bodoni 72", Georgia, serif', letterSpacing: '0.28em', fontWeight: 400 };
export const GOLD = '#b89a6a';
export const GOLD_LINE = 'color-mix(in srgb, #b89a6a 32%, transparent)';
