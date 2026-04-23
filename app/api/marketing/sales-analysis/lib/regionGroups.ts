// 지역 그룹: label → 검색 키워드들 (해당 키워드가 region 값에 포함되면 매칭)
export const REGION_GROUPS: Record<string, { label: string; keywords: string[] }[]> = {
  '프랑스': [
    { label: '부르고뉴', keywords: ['Bourgogne','Burgundy','Chablis','Nuits','Beaune','Beaujolais','Chalonnaise','Mâconnais','Maconnais','Meursault','Mersault','Puligny','Chassagne','Volnay','Pommard','Gevrey','Chambertin','Chambolle','Musigny','Vosne','Romanee','Romanée','Corton','Aloxe','Montrachet','Aligote','Aligoté','Fixin','Marsannay','Monthelie','Auxey','Rully','Mercurey','Saint Aubin','Chorey','Savigny','Santenay','Clos de Vougeot','Irancy'] },
    { label: '보르도', keywords: ['Bordeaux','Médoc','Medoc','Graves','Sauternes','Pauillac','Saint-Emilion','Saint Emilion','Pomerol','Margaux','Haut-Médoc','Pessac'] },
    { label: '론', keywords: ['Rhône','Rhone','Condrieu','Hermitage','Cornas','Saint Joseph','Chateauneuf','Châteauneuf','Cotes du Rhone','Côtes du Rhône','Luberon','Gigondas','Vacqueyras'] },
    { label: '샴페인', keywords: ['Champagne','Charly-sur-Marne'] },
    { label: '알자스', keywords: ['Alsace'] },
    { label: '루아르', keywords: ['Loire','Sancerre','Chinon','Vouvray','Muscadet'] },
    { label: '랑그독', keywords: ['Languedoc'] },
    { label: '프로방스', keywords: ['Provence'] },
    { label: '크레망', keywords: ['Crémant','Cremant'] },
  ],
  '이탈리아': [
    { label: '토스카나', keywords: ['Toscan','Tuscan','Chianti','Bolgheri','Montalcino','Montepulciano'] },
    { label: '피에몬테', keywords: ['Piemont','Piedmont','Barolo','Barbaresco','Asti','Langhe'] },
    { label: '베네토', keywords: ['Veneto','Valpolicella','Soave','Prosecco'] },
    { label: '시칠리아', keywords: ['Sicil'] },
    { label: '풀리아', keywords: ['Puglia'] },
    { label: '캄파니아', keywords: ['Campania'] },
  ],
  '칠레': [
    { label: '센트럴 밸리', keywords: ['Central'] },
    { label: '마이포', keywords: ['Maipo'] },
    { label: '콜차구아', keywords: ['Colchagua'] },
    { label: '카사블랑카', keywords: ['Casablanca'] },
    { label: '아콩카과', keywords: ['Aconcagua'] },
    { label: '레이다', keywords: ['Leyda'] },
  ],
  '포르투갈': [
    { label: '도우로', keywords: ['Douro'] },
    { label: '알렌테주', keywords: ['Alentejo'] },
    { label: '다옹', keywords: ['Dao','Dão'] },
    { label: '마데이라', keywords: ['Madeira'] },
  ],
  '호주': [
    { label: '바로사', keywords: ['Barossa'] },
    { label: '맥라렌 베일', keywords: ['McLaren'] },
    { label: '마가렛 리버', keywords: ['Margaret'] },
    { label: '이든 밸리', keywords: ['Eden'] },
  ],
  '미국': [
    { label: '나파 밸리', keywords: ['Napa'] },
    { label: '소노마', keywords: ['Sonoma'] },
    { label: '캘리포니아', keywords: ['California'] },
    { label: '오레곤', keywords: ['Oregon'] },
  ],
  '뉴질랜드': [
    { label: '말보로', keywords: ['Marlborough'] },
    { label: '혹스 베이', keywords: ['Hawke'] },
  ],
  '스페인': [
    { label: '리오하', keywords: ['Rioja'] },
    { label: '프리오랏', keywords: ['Priorat'] },
    { label: '리베라 델 두에로', keywords: ['Ribera'] },
  ],
};

// 하위 지역 그룹: 지역 > 세부 지역
export const SUB_REGION_GROUPS: Record<string, Record<string, { label: string; keywords: string[] }[]>> = {
  '프랑스': {
    '부르고뉴': [
      { label: '샤블리', keywords: ['Chablis'] },
      { label: '코트 드 뉘', keywords: ['Nuits','Gevrey','Chambertin','Chambolle','Musigny','Vosne','Romanee','Romanée','Fixin','Marsannay','Clos de Vougeot','Nuits St'] },
      { label: '코트 드 본', keywords: ['Beaune','Meursault','Mersault','Puligny','Chassagne','Volnay','Pommard','Corton','Aloxe','Montrachet','Monthelie','Auxey','Saint Aubin','Chorey','Savigny','Santenay','Blagny'] },
      { label: '보졸레', keywords: ['Beaujolais'] },
      { label: '마코네', keywords: ['Mâconnais','Maconnais','Macon'] },
      { label: '부르고뉴 기타', keywords: ['Bourgogne','Burgundy','Aligote','Aligoté','Rully','Mercurey','Chalonnaise','Irancy','Auxerre','Crémant de Bourgogne'] },
    ],
    '보르도': [
      { label: '메독', keywords: ['Médoc','Medoc','Margaux','Pauillac','Saint-Julien','Saint-Estephe','Haut-Médoc'] },
      { label: '우안', keywords: ['Saint-Emilion','Saint Emilion','Pomerol'] },
      { label: '그라브/소테른', keywords: ['Graves','Sauternes','Pessac','Barsac'] },
      { label: '보르도 기타', keywords: ['Bordeaux'] },
    ],
    '론': [
      { label: '북부 론', keywords: ['Northern Rhône','Condrieu','Hermitage','Cornas','Saint Joseph','Cote Rotie','Côte-Rôtie'] },
      { label: '남부 론', keywords: ['Southern Rhône','Chateauneuf','Châteauneuf','Gigondas','Vacqueyras','Luberon','Cotes du Rhone','Côtes du Rhône','Ventoux'] },
    ],
  },
  '이탈리아': {
    '토스카나': [
      { label: '키안티', keywords: ['Chianti'] },
      { label: '볼게리', keywords: ['Bolgheri'] },
      { label: '몬탈치노', keywords: ['Montalcino'] },
      { label: '토스카나 기타', keywords: ['Toscan','Tuscan'] },
    ],
    '피에몬테': [
      { label: '바롤로', keywords: ['Barolo'] },
      { label: '바르바레스코', keywords: ['Barbaresco'] },
      { label: '피에몬테 기타', keywords: ['Piemont','Piedmont','Asti','Langhe'] },
    ],
  },
};

export function matchRegionGroup(region: string, keywords: string[]): boolean {
  const r = region.toLowerCase();
  return keywords.some((kw) => r.includes(kw.toLowerCase()));
}

export function resolveRegionGroup(country: string, region: string): string {
  const groups = REGION_GROUPS[country];
  if (!groups) return region;
  for (const g of groups) {
    if (matchRegionGroup(region, g.keywords)) return g.label;
  }
  return region;
}

export function resolveSubRegion(country: string, regionGroup: string, region: string): string {
  const subs = SUB_REGION_GROUPS[country]?.[regionGroup];
  if (!subs) return region;
  for (const s of subs) {
    if (matchRegionGroup(region, s.keywords)) return s.label;
  }
  return region;
}
