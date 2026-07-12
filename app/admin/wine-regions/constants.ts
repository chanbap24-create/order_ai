import type { WineRegion } from './types';

export const COUNTRIES = [
  { value: '', label: '전체', flag: '' },
  { value: '프랑스 France', label: '프랑스', flag: '🇫🇷' },
  { value: '이탈리아 Italy', label: '이탈리아', flag: '🇮🇹' },
  { value: '스페인 Spain', label: '스페인', flag: '🇪🇸' },
  { value: '미국 USA', label: '미국', flag: '🇺🇸' },
  { value: '호주 Australia', label: '호주', flag: '🇦🇺' },
  { value: '포르투갈 Portugal', label: '포르투갈', flag: '🇵🇹' },
  { value: '아르헨티나 Argentina', label: '아르헨티나', flag: '🇦🇷' },
  { value: '뉴질랜드 New Zealand', label: '뉴질랜드', flag: '🇳🇿' },
  { value: '칠레 Chile', label: '칠레', flag: '🇨🇱' },
  { value: '영국 England', label: '영국', flag: '🇬🇧' },
];

export const EMPTY_REGION: WineRegion = {
  id: 0,
  country: '프랑스 France',
  major_region: '',
  sub_region: '',
  appellation: '',
  cru_vineyard: '',
  classification: '',
  grape_varieties: '',
  notes: '',
};

export function getCountryFlag(country: string) {
  const found = COUNTRIES.find(c => c.value === country);
  return found?.flag || '';
}

export function classColor(cls: string | null) {
  if (!cls) return 'var(--text-muted)';
  const c = cls.toLowerCase();
  if (c.includes('grand cru') && !c.includes('classé')) return 'var(--color-primary-light)';
  if (c.includes('1er') || c.includes('premier')) return '#B8860B';
  if (c.includes('classé') || c.includes('docg') || c.includes('doca')) return 'var(--action)';
  if (c.includes('village') || c.includes('doc') || c === 'doc') return '#2E7D32';
  if (c.includes('mga') || c.includes('cru')) return '#6B4E2F';
  if (c.includes('bourgeois')) return '#795548';
  return 'var(--neutral-500)';
}
