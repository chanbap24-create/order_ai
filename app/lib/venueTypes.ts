// 거래처 업장 유형 분류(요리/성격). 세일즈에서 태깅 → 추후 추천 프로파일 근거.
// 가격대는 이번 단계에서 제외(분류만). wine 힌트는 표시·추후 추천 매핑용 참고값.

export interface VenueItem { key: string; label: string; wine: string }
export interface VenueGroup { category: string; label: string; items: VenueItem[] }

export const VENUE_GROUPS: VenueGroup[] = [
  {
    category: 'jp', label: '일식', items: [
      { key: 'sushi', label: '스시·오마카세', wine: '샴페인·스파클링·화이트(샤블리/부르고뉴)' },
      { key: 'washoku', label: '정통 일식·카이세키', wine: '화이트·샴페인·섬세한 레드(피노)' },
      { key: 'izakaya', label: '이자카야·일식주점', wine: '스파클링·화이트·가벼운 레드' },
      { key: 'yakitori', label: '야키토리·꼬치', wine: '스파클링·가벼운 레드' },
      { key: 'unagi', label: '우나기·장어', wine: '화이트·리슬링·피노누아' },
      { key: 'ramen', label: '라멘·돈카츠·캐주얼 일식', wine: '스파클링·데일리' },
    ],
  },
  {
    category: 'western', label: '양식', items: [
      { key: 'steak', label: '스테이크·그릴', wine: '레드(까베르네·말벡·시라)' },
      { key: 'french', label: '프렌치·파인다이닝', wine: '부르고뉴·보르도, 다양·프리미엄' },
      { key: 'italian', label: '이탈리안(파스타·피자)', wine: '이탈리아 레드·화이트' },
      { key: 'spanish', label: '스페인·타파스', wine: '템프라니요·카바' },
      { key: 'bistro', label: '비스트로·아메리칸', wine: '다양·캐주얼 레드' },
      { key: 'seafood_w', label: '시푸드·오이스터바', wine: '화이트·샴페인' },
    ],
  },
  {
    category: 'kr', label: '한식', items: [
      { key: 'kbbq', label: '고기구이(삼겹·갈비·소)', wine: '레드·캐주얼' },
      { key: 'hanjeongsik', label: '한정식·모던한식', wine: '화이트·레드 균형·다양' },
      { key: 'hoetjip', label: '횟집·해산물', wine: '화이트·샴페인' },
      { key: 'jjim', label: '찜·탕·전골', wine: '화이트·가벼운 레드' },
      { key: 'kfusion', label: '퓨전 한식', wine: '다양(전 타입 균형)·주정강화 제외' },
    ],
  },
  {
    category: 'cn', label: '중식', items: [
      { key: 'cantonese', label: '광동·딤섬', wine: '화이트·스파클링·리슬링' },
      { key: 'sichuan', label: '사천·마라(매움)', wine: '리슬링·게뷔르츠·과일향 레드' },
      { key: 'chinese_gen', label: '일반 중식', wine: '화이트·가벼운 레드' },
    ],
  },
  {
    category: 'etc', label: '기타 업태', items: [
      { key: 'fusion', label: '퓨전·모던다이닝', wine: '다양(전 타입 균형)·주정강화 제외' },
      { key: 'winebar', label: '와인바·내추럴와인바', wine: '다양·트렌디·내추럴' },
      { key: 'hotel', label: '호텔', wine: '전방위·프리미엄(샴페인·부르고뉴·보르도)' },
      { key: 'buffet', label: '뷔페', wine: '다양·대중(화이트·레드·스파클링 두루)' },
      { key: 'bar', label: '바·펍·라운지', wine: '스파클링·캐주얼' },
      { key: 'cafe', label: '카페·디저트·베이커리', wine: '스파클링·스위트·데일리' },
      { key: 'retail', label: '리테일(샵·편의점·백화점)', wine: '대중 인기·가성비' },
      { key: 'wholesale', label: '도매장', wine: '재판매용·대중 인기·전 타입' },
    ],
  },
];

export interface VenueInfo { key: string; label: string; category: string; catLabel: string; wine: string }

/** key → 정보 조회 */
export const VENUE_MAP: Record<string, VenueInfo> = (() => {
  const m: Record<string, VenueInfo> = {};
  for (const g of VENUE_GROUPS) {
    for (const it of g.items) {
      m[it.key] = { key: it.key, label: it.label, category: g.category, catLabel: g.label, wine: it.wine };
    }
  }
  return m;
})();

export const isValidVenue = (v: string | null | undefined): boolean => !!v && v in VENUE_MAP;
