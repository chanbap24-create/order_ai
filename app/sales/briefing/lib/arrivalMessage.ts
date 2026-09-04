// 통관 완료 → 거래처에 보낼 카톡/문자 안내 문구 (복사-붙여넣기용)
// 수금 문구(collectionMessage)와 같은 문법: 인사+직급 서명, 거래처명 본문 포함, 청유형.
import type { Sender } from './collectionMessage';

const fmt = (n: number) => n.toLocaleString();

export type ArrivalMessageItem = {
  itemName: string;
  vintage?: string;        // '2022' | 'NV' | '' (품번에서 도출)
  supplyPrice?: number;    // 정상 공급가 (0이면 가격 줄 생략)
  discountRate?: number;   // 소수 (0.1 = 10%) — 견적 이력 → 기본할인률 → 수동 입력 순으로 결정된 값
  shipDateLabel?: string | null; // '9월 8일(화)' — 통관일+영업일 2일. null이면 바로 출고 가능
};

const vintageLabelOf = (v?: string) => (v === 'NV' || v === 'MV' ? ' NV' : v ? ` ${v}` : '');

// 품목 1건의 ▸ 항목 줄들 (가격·할인·출고일). 카톡 말풍선 폭(~18자)에 맞춘 짧은 줄.
function itemLines(it: ArrivalMessageItem): string[] {
  const lines: string[] = [];
  if (it.supplyPrice && it.supplyPrice > 0) {
    lines.push(`▸ 정상 공급가 ${fmt(it.supplyPrice)}원 (VAT 별도)`);
    if (it.discountRate && it.discountRate > 0) {
      lines.push(`▸ 할인가 ${fmt(Math.round(it.supplyPrice * (1 - it.discountRate)))}원`);
    }
  }
  lines.push(it.shipDateLabel ? `▸ 출고 ${it.shipDateLabel}부터 가능` : `▸ 바로 출고 가능`);
  return lines;
}

/** 같은 거래처가 기다린 통관 품목들을 한 통으로 — 1종이면 단일 카드, 여러 종이면 [품목명] 블록 반복.
 *  variant: waiting=대기 등록 거래처("기다려 주셨던") / used=이전 빈티지 구매 거래처("사용해 주셨던 와인의 새 빈티지") */
export function buildArrivalMessage(p: {
  clientName: string;
  items: ArrivalMessageItem[];
  variant?: 'waiting' | 'used';
  sender?: Sender;
}): string {
  // 입고 대기(incoming_requests)는 CDV 와인 전용 — 법인 고정
  const who = p.sender?.manager
    ? `까브드뱅 ${p.sender.manager}${p.sender.title ? ` ${p.sender.title}` : ''}`
    : '까브드뱅';
  const many = p.items.length > 1;

  const intro = p.variant === 'used'
    ? `${p.clientName}에서 사용해 주셨던\n와인${many ? ` ${p.items.length}종` : ''}의 새 빈티지가 들어왔습니다.`
    : `${p.clientName}에서 기다려 주셨던\n와인${many ? ` ${p.items.length}종` : ''}이 통관을 마치고 들어왔습니다.`;
  const blocks = many
    ? p.items.map((it) => [`[${it.itemName}${vintageLabelOf(it.vintage)}]`, ...itemLines(it)].join('\n'))
    : [[`▸ ${p.items[0].itemName}${vintageLabelOf(p.items[0].vintage)}`, ...itemLines(p.items[0])].join('\n')];

  return [
    `안녕하세요\n${who}입니다.`,
    intro,
    ...blocks,
    `발주 주시면 일정에 맞춰\n보내드리겠습니다. 늘 감사드립니다.`,
  ].join('\n\n');
}

// ── 출고 가능일 계산: 통관일 + 영업일 2일 (주말·공휴일 제외) ──

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function addBusinessDays(startISO: string, n: number, holidays: Set<string>): string {
  const d = new Date(`${startISO}T00:00:00Z`);
  let count = 0;
  while (count < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) count++;
  }
  return d.toISOString().slice(0, 10);
}

/** '9월 8일(화)' 형태 라벨 */
export function shipDateLabelOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${DOW[d.getUTCDay()]})`;
}
