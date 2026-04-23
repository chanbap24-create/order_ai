export const COUNTRIES = [
  '프랑스',
  '이탈리아',
  '칠레',
  '포르투갈',
  '호주',
  '미국',
  '뉴질랜드',
  '스페인',
  '아르헨티나',
  '독일',
  '영국',
];

export const REGIONS: Record<string, { label: string; search: string }[]> = {
  '프랑스': [
    { label: '보르도', search: 'Médoc,Graves,Right Bank,Sauternes,보르도' },
    { label: '부르고뉴', search: 'Bourgogne,Chablis,Nuits,Beaune,Chalonnaise,Mâconnais,Régionale' },
    { label: '론', search: 'Rhône,Northern Rhône,Southern Rhône' },
    { label: '샴페인', search: 'Champagne' },
    { label: '알자스', search: 'Alsace' },
    { label: '루아르', search: 'Loire' },
    { label: '랑그독', search: 'Languedoc' },
    { label: '프로방스', search: 'Provence' },
    { label: '샤블리', search: 'Chablis' },
    { label: '보졸레', search: 'Beaujolais' },
  ],
  '이탈리아': [
    { label: '토스카나', search: 'Toscan,Tuscan' },
    { label: '피에몬테', search: 'Piemont,Piedmont' },
    { label: '베네토', search: 'Veneto' },
    { label: '시칠리아', search: 'Sicil' },
    { label: '풀리아', search: 'Puglia' },
    { label: '캄파니아', search: 'Campania' },
  ],
  '칠레': [
    { label: '마이포', search: 'Maipo' },
    { label: '콜차구아', search: 'Colchagua' },
    { label: '카사블랑카', search: 'Casablanca' },
    { label: '라펠', search: 'Rapel' },
    { label: '아콩카과', search: 'Aconcagua' },
    { label: '레이다', search: 'Leyda' },
  ],
  '포르투갈': [
    { label: '도우로', search: 'Douro' },
    { label: '알렌테주', search: 'Alentejo' },
    { label: '다옹', search: 'Dao,Dão' },
    { label: '마데이라', search: 'Madeira' },
  ],
  '호주': [
    { label: '바로사', search: 'Barossa' },
    { label: '맥라렌 베일', search: 'McLaren' },
    { label: '마가렛 리버', search: 'Margaret' },
    { label: '헌터 밸리', search: 'Hunter' },
    { label: '야라 밸리', search: 'Yarra' },
  ],
  '미국': [
    { label: '나파 밸리', search: 'Napa' },
    { label: '소노마', search: 'Sonoma' },
    { label: '워싱턴', search: 'Washington' },
    { label: '오레곤', search: 'Oregon' },
    { label: '캘리포니아', search: 'California' },
  ],
  '뉴질랜드': [
    { label: '말보로', search: 'Marlborough' },
    { label: '혹스 베이', search: 'Hawke' },
    { label: '센트럴 오타고', search: 'Otago' },
  ],
  '스페인': [
    { label: '리오하', search: 'Rioja' },
    { label: '리베라 델 두에로', search: 'Ribera' },
    { label: '프리오랏', search: 'Priorat' },
    { label: '페네데스', search: 'Penedes' },
  ],
  '아르헨티나': [
    { label: '멘도사', search: 'Mendoza' },
    { label: '우코 밸리', search: 'Uco' },
  ],
  '독일': [
    { label: '모젤', search: 'Mosel' },
    { label: '라인가우', search: 'Rheingau' },
    { label: '팔츠', search: 'Pfalz' },
  ],
};

export const SUB_REGIONS: Record<string, Record<string, { label: string; search: string }[]>> = {
  '프랑스': {
    '부르고뉴': [
      { label: '샤블리', search: 'Chablis' },
      { label: '코트 드 뉘', search: 'Nuits,Gevrey,Chambertin,Chambolle,Musigny,Vosne,Romanee,Romanée,Fixin,Marsannay,Clos de Vougeot,Nuits St' },
      { label: '코트 드 본', search: 'Beaune,Meursault,Mersault,Puligny,Chassagne,Volnay,Pommard,Corton,Aloxe,Montrachet,Monthelie,Auxey,Saint Aubin,Chorey,Savigny,Santenay,Blagny' },
      { label: '보졸레', search: 'Beaujolais' },
      { label: '마코네', search: 'Mâconnais,Maconnais,Macon' },
    ],
    '보르도': [
      { label: '메독', search: 'Médoc,Medoc,Margaux,Pauillac,Saint-Julien,Saint-Estephe,Haut-Médoc' },
      { label: '우안', search: 'Saint-Emilion,Saint Emilion,Pomerol' },
      { label: '그라브/소테른', search: 'Graves,Sauternes,Pessac,Barsac' },
    ],
    '론': [
      { label: '북부 론', search: 'Northern Rhône,Condrieu,Hermitage,Cornas,Saint Joseph,Cote Rotie,Côte-Rôtie' },
      { label: '남부 론', search: 'Southern Rhône,Chateauneuf,Châteauneuf,Gigondas,Vacqueyras,Luberon,Ventoux' },
    ],
  },
  '이탈리아': {
    '토스카나': [
      { label: '키안티', search: 'Chianti' },
      { label: '볼게리', search: 'Bolgheri' },
      { label: '몬탈치노', search: 'Montalcino' },
    ],
    '피에몬테': [
      { label: '바롤로', search: 'Barolo' },
      { label: '바르바레스코', search: 'Barbaresco' },
    ],
  },
};

export const PRICE_PRESETS = [
  { label: '~1만', min: 0, max: 10000 },
  { label: '1~2만', min: 10000, max: 20000 },
  { label: '2~3만', min: 20000, max: 30000 },
  { label: '3~5만', min: 30000, max: 50000 },
  { label: '5~10만', min: 50000, max: 100000 },
  { label: '10만~', min: 100000, max: 999999999 },
];

export const CY = new Date().getFullYear();
export const YEARS = Array.from({ length: CY - 2019 }, (_, i) => 2020 + i);

export const YEAR_PRESETS = [
  { label: '작년', start: CY - 1, end: CY - 1 },
  { label: '올해', start: CY, end: CY },
  { label: '최근 2년', start: CY - 1, end: CY },
  { label: '최근 3년', start: CY - 2, end: CY },
  { label: '최근 4년', start: CY - 3, end: CY },
  { label: '전체', start: 2020, end: CY },
];

export const DEFAULT_BUSINESS_TYPES = [
  'etc/기타',
  'off/백화점',
  'off/편의점',
  'off/할인점',
  'on/도매장',
  'on/샵',
  'on/업소',
  'on/호텔',
  '백화점',
  '백화점(와인)',
  '(미분류)',
];
