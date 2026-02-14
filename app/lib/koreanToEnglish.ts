// 한글 와인명 → 영문 와인명 자동 변환

const KR_EN: Record<string, string> = {
  // 품종
  '카베르네 소비뇽': 'Cabernet Sauvignon', '카베르네소비뇽': 'Cabernet Sauvignon',
  '피노 누아': 'Pinot Noir', '피노누아': 'Pinot Noir',
  '메를로': 'Merlot', '시라': 'Syrah', '시라즈': 'Shiraz', '쉬라즈': 'Shiraz',
  '카르메네르': 'Carmenere', '말벡': 'Malbec', '소비뇽 블랑': 'Sauvignon Blanc',
  '소비뇽블랑': 'Sauvignon Blanc', '샤르도네': 'Chardonnay', '리슬링': 'Riesling',
  '진판델': 'Zinfandel', '템프라니요': 'Tempranillo', '가르나차': 'Garnacha',
  '게부르츠트라미네': 'Gewurztraminer', '게부르츠트라미너': 'Gewurztraminer',
  '베르멘티노': 'Vermentino', '네비올로': 'Nebbiolo', '돌체토': 'Dolcetto',
  '알리고테': 'Aligote', '슈냉': 'Chenin Blanc', '비오니에': 'Viognier',
  '모스카토': 'Moscato', '피노그리': 'Pinot Gris', '소비뇽': 'Sauvignon',
  '무스까': 'Muscat', '카베르네': 'Cabernet', '그르나슈': 'Grenache',
  '토우리가': 'Touriga', '쁘띠 시라': 'Petite Sirah',

  // 지역/아펠라시옹
  '부르고뉴': 'Bourgogne', '보르도': 'Bordeaux', '샤블리': 'Chablis',
  '뫼르소': 'Meursault', '뿔리니 몽라셰': 'Puligny-Montrachet', '뿔리니': 'Puligny',
  '몽라셰': 'Montrachet', '샹볼 뮈지니': 'Chambolle-Musigny',
  '본 로마네': 'Vosne-Romanee', '제브레 샹베르탱': 'Gevrey-Chambertin',
  '꼬뜨 뒤 론': 'Cotes du Rhone', '코트 드 뉘이': 'Cote de Nuits',
  '코트 드 뉘': 'Cote de Nuits', '코트 도세르': "Cotes d'Auxerre",
  '나파밸리': 'Napa Valley', '나파 밸리': 'Napa Valley',
  '산타리타 힐스': 'Sta. Rita Hills', '산타바바라': 'Santa Barbara',
  '오크빌': 'Oakville', '파소 로블레스': 'Paso Robles',
  '샤샤뉴 몽라셰': 'Chassagne-Montrachet', '사비니 레 본': 'Savigny-les-Beaune',
  '쇼레 레 본': 'Chorey-les-Beaune', '옥세 듀레스': 'Auxey-Duresses',
  '옥세-뒤레스': 'Auxey-Duresses', '마르사네': 'Marsannay',
  '라두아': 'Ladoix', '상트네': 'Santenay',
  '코르통 샤를마뉴': 'Corton-Charlemagne', '바르바레스코': 'Barbaresco',
  '키안티 클라시코': 'Chianti Classico', '보졸레빌라쥐': 'Beaujolais-Villages',
  '알자스': 'Alsace', '크레망 드 부르고뉴': 'Cremant de Bourgogne',
  '베네토': 'Veneto', '달바': "d'Alba", '몬테레이': 'Monterey',
  '스프링마운틴': 'Spring Mountain',
  '오뜨 코트 드 뉘': 'Hautes-Cotes de Nuits',
  '꼬또 부르기뇽': 'Coteaux Bourguignons',

  // 와인 용어
  '브륏': 'Brut', '리저브': 'Reserve', '리제르바': 'Riserva',
  '레제르바': 'Reserva', '밀레짐': 'Millesime', '밀레짐e': 'Millesime',
  '그랑 크뤼': 'Grand Cru', '그랑크뤼': 'Grand Cru',
  '프리미에': 'Primeur', '1er Cru': '1er Cru', '1er': '1er',
  '로제': 'Rose', '블랑': 'Blanc', '루즈': 'Rouge',
  '블랑 드 블랑': 'Blanc de Blancs', '블랑 데 밀레네르': 'Blanc des Millenaires',
  '드미섹': 'Demi-Sec', '빈티지': 'Vintage', '토니': 'Tawny',
  '에스테이트': 'Estate', '셀렉션': 'Selection',
  '퀴베': 'Cuvee', '비에유 비뉴': 'Vieilles Vignes',
  '브뤼 로제': 'Brut Rose',

  // 일반
  '샤또': 'Chateau', '샤토': 'Chateau', '도멘': 'Domaine', '메종': 'Maison',
  '퀸타': 'Quinta', '샴페인': 'Champagne',

  // 생산자
  '비온디 산티': 'Biondi Santi', '찰스 하이직': 'Charles Heidsieck', '찰스하이직': 'Charles Heidsieck',
  '그라함': "Graham's", '로버트 오틀리': 'Robert Oatley',
  '에밀리아나': 'Emiliana', '뱅상 지라르댕': 'Vincent Girardin',
  '루이스 세아브라': 'Luis Seabra', '로돌프 드모조': 'Rodolphe Demougeot',
  '르로아': 'Leroy', '마르셀 다이스': 'Marcel Deiss',
  '로저 벨랑': 'Roger Belland', '루이 미쉘': 'Louis Michel',
  '수마로카': 'Sumarroca', '볼파이아': 'Volpaia', '수티랑': 'Soutiran',
  '뵈브 암발': 'Veuve Ambal', '차카나': 'Chakana',
  '페스 파커': 'Fess Parker', '레이크 찰리스': 'Lake Chalice',
  '갤리카': 'Gallica', '도프': 'Dopff au Moulin', '꿀리 뒤떼이': 'Couly Dutheil',
  '도팡': 'Les Dauphins', '센티르': 'Sentir',
  '안셀미': 'Anselmi', '클레멈 라발리': 'Clement Lavallee',
  '브뤼넬 드 라 가르딘': 'Brunel de la Gardine',
  '도멘 기 & 이반 뒤폴레르': 'Domaine Guy & Yvan Dufouleur',
  '도멘 기': 'Domaine Guy', '뒤폴레르': 'Dufouleur',
  '갬블': 'Gamble', '후플라': 'Hoopla', '페어겔레겐': 'Vergelegen',
  '램본': 'Rambone', '랭 트윈스': 'Lange Twins',
  '포그 & 라잇': 'Fog & Light', '리아타': 'Riata', '릿지': 'Ridge',
  '다이아몬드': 'Diamond',
  '알베르 모로': 'Albert Morot', '마스 마르티네': 'Mas Martinet',
  '머드하우스': 'Mud House', '피터 프레너스': 'Peter Franus',
  '로랑 트루페흐': 'Laurent Truffer',

  // 특정 와인명
  'BdM DOCG': 'Brunello di Montalcino DOCG',
  '아나타': 'Annata', '콜렉션': 'Collection', '콜렉시옹': 'Collection',
  '아도베': 'Adobe', '코얌': 'Coyam', '노바스': 'Novas', '나뚜라': 'Natura',
  '에코발란스': 'Eco Balance', '안데스 피크': 'Andes Peak',
  'SDO': 'Signos de Origen', '에트니코': 'Etnico', '아말루나': 'Amaluna',
  '레 볼떼': 'Le Volte', '마세토': 'Masseto',
  '시스토': 'Xisto', '일리미타도': 'Ilimitado', '크루': 'Cru',
  '팔콘': 'The Falcon', '랩터': 'The Raptor', '네스트': 'The Nest',
  '페넌트': 'The Pennant', '포켓왓치': 'Pocketwatch', '비치헛': 'Beach Hut',
  '피니스테르': 'Finisterre', '핸콕앤핸콕': 'Hancock & Hancock',
  '포 인 핸드': 'Four in Hand',
  '누나': 'Nuna', '아이니': 'Ayniy', '치토': 'Il Puro',
  '레 자딜레': 'Les Adilles', '샹트 메흘르': 'Chante Merle',
  '코트 드 주앙': 'Cote de Jouan', '그랑 로쉬': 'Grand Roche',
  '보리아': 'Bohria',
  '알타노': 'Altano', '베수비오': 'Vesuvio', '도 베수비오': 'do Vesuvio',
  '식스 그레이프': 'Six Grapes', '레이트 바틀드': 'Late Bottled',
  '싱글 하베스트': 'Single Harvest', '말베도스': 'Malvedos',
  '셀라 마스터스': 'Cellar Masters', '트릴로지': 'Trilogy',
  '에쎄죠': 'Echezeaux', '뮈지니': 'Musigny',
  '로마네 생 비방': 'Romanee-Saint-Vivant',
  '오 브륄레': 'Aux Brulees', '레 보 몽': 'Les Beaux Monts',
  '오 제네브리에르': 'Aux Genavrieres', '레 퓌': 'Les Fuees',
  '끌로 생 데지레': 'Clos Saint-Desire', '클로 생 데지레': 'Clos Saint-Desire',
  '상뜨노': 'Santenots', '모조': 'Morgeot',
  '레 슈네보': 'Les Chenevottes', '정세니에': 'Les Enseigneres',
  '몬테 드 토네르': 'Montee de Tonnerre', '그르누이': 'Grenouilles',
  '뷔토': 'Butteaux', '르 보르가르': 'Le Beauregard',
  '슈발 블랑': 'Cheval Blanc', '디껨': "d'Yquem", '라투르': 'Latour',
  '무통 롯실드': 'Mouton Rothschild', '쉬디로': 'Suduiraut',
  '마지칼레': 'Mazzi Caliere', '로사나': 'Rosana',
  '프리미에르 플뢰르': 'Premiere Fleur',
  '크라예': 'Crayeres', '컬렉터스 에디션': "Collector's Edition",
  '그레이프': 'Grapes', '레제르바 데 라 파밀리아': 'Reserva de la Familia',
  '그랑 주베 이 깜프': 'Gran Juve y Camps',
  '블랜디스': "Blandy's", '마데이라': 'Madeira', '부알': 'Bual',
  '세르시알': 'Sercial', '테란테즈': 'Terrantez', '맘지': 'Malmsey',
  '토이메이커': 'Toymaker',
  '애쉴리스': "Ashley's", '임페리움 비니': 'Imperium Vini',
  '에디지오네 펜니노': 'Edizione Pennino',
  '로카 기치아르다': 'Rocca di Castagnoli', 'CCR': 'Chianti Classico Riserva',
  '브롤리오': 'Brolio', 'CC': 'Chianti Classico',
  '생 뱅상': 'Saint-Vincent', '샤흘리-슈흐-마흔느': 'Charly-sur-Marne',
  '레귀에뜨-호믈로': "L'Eguillette-Romelot", '끌로 뒤 몽도랑': 'Clos du Montdarant',
  '엘스 에스쿠르콘': 'Els Escurcons',
  '본': 'Beaune', '튜혼': 'Teurons',
  '마지스트레잇': 'Magistrate',
  '그렌지': 'Grange',
  '브렌들린': 'Brandlin', '빈야드': 'Vineyard',
  '셰그': 'Sceg', '이콰나': 'Icauna',
  '갈로셰': 'Galoche', '비네아 나뚜라': 'Vinea Natura',
  '뷰 샹트카유': 'Vieux Chantecaille', '마이에': 'Maillet',
  '리톤 스프링': 'Lytton Springs', '리톤 에스테이트': 'Lytton Estate',
  '50주년': '50th Anniversary', '몬테벨로': 'Monte Bello',
  '카피텔리': 'Capitel Foscarino', '레알다': 'Realda',
  '산 빈센죠': 'San Vincenzo', '레 그라비에': 'Les Gravieres',
  '르 100%': 'Le 100%', '샤를루': 'Charlot',
  '끌로': 'Clos', '뒤 로이': 'du Roy', '비뉴 마리': 'Vignes Marie',
  '드모아젤 위게뜨': 'Demoiselle Huguette',
  '콘세이토': 'Conceito', '쓰리카운티': 'Three County',
  '포트': 'Port', '빈티지 포트': 'Vintage Port',
  '프렐리우스': 'Prelius',
  '뉴 라벨': 'New Label', '신규라벨': 'New Label',
  '20주년 에디션': '20th Anniversary Edition',
  '지구의 날 에디션': 'Earth Day Edition',
  '벚꽃 에디': 'Cherry Blossom Edition',
  '바따르': 'Batard', '슈발리에': 'Chevalier',
  '45도': '45 Degrees',
  '시그니처': 'Signature', '시그니쳐': 'Signature',
  '쌩 이뽈리뜨': 'Saint-Hippolyte', '생 이뽈리뜨': 'Saint-Hippolyte',
  '알텐베르그 드 베르그하임': 'Altenberg de Bergheim',
  '샴페인 찰리': 'Champagne Charlie',
  '앙 라 리샤르': 'En la Richarde',
};

// 긴 것부터 정렬 (겹침 방지)
const SORTED_TERMS = Object.entries(KR_EN).sort((a, b) => b[0].length - a[0].length);

/**
 * 한글 와인명을 영문으로 변환
 * 변환 불가능하면 null 반환
 */
export function translateWineName(krName: string | null): string | null {
  if (!krName) return null;

  let en = krName;
  for (const [kr, eng] of SORTED_TERMS) {
    en = en.split(kr).join(eng);
  }

  // 남은 한글이 3글자 초과면 변환 실패
  const remaining = en.replace(/[^가-힣]/g, '');
  if (remaining.length > 3) return null;

  // 잔여 한글 제거, 정리
  en = en.replace(/[가-힣]+/g, '').replace(/\s+/g, ' ').trim();
  en = en.replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim();

  if (en.length < 3) return null;
  return en;
}
