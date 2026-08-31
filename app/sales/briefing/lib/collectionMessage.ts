import type { CollItem } from '../hooks/useCollectionBriefing';

// 수금 브리핑 → 거래처에 보낼 카톡/문자 문구 생성 (복사-붙여넣기용)

type Mode = 'broken' | 'today' | 'overdue';
export type Sender = { manager: string; title: string | null };

const CORP: Record<string, string> = { wine: '까브드뱅', glass: '대유라이프' };
// 입금 계좌 — 법인별
const ACCOUNT: Record<string, string> = {
  wine: '기업은행 (예금주: 까브드뱅) 500-042293-04-015',
  glass: '기업은행 (예금주: (주)대유라이프) 500-042529-01-016',
};

const fmt = (n: number) => n.toLocaleString();
const mmdd = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;

export function buildCollectionMessage(it: CollItem, mode: Mode, sender?: Sender): string {
  const corp = CORP[it.client_type] || '';
  const amount = it.promised_amount ?? (it.overdue > 0 ? it.overdue : it.net_balance);
  const who = sender?.manager ? `${corp} ${sender.manager}${sender.title ? ` ${sender.title}` : ''}` : corp;

  // 금액 = 설정된 약속 금액 우선(부분 수금 약속 존중), 없으면 연체액 → 잔액
  // 부분 입금: 약속 금액 중 일부만 확인된 경우 입금액·차액을 명시
  const paid = it.promised_paid || 0;
  const partial = (mode === 'today' || mode === 'broken')
    && it.promised_amount != null && paid > 0 && paid < it.promised_amount;
  const diff = partial ? it.promised_amount! - paid : 0;

  const body: string[] = [];
  if (partial) {
    const when = it.promised_date ? `${mmdd(it.promised_date)} 결제 예정이셨던` : '약속하신';
    body.push(`${when} ${fmt(it.promised_amount!)}원 중 ${fmt(paid)}원 입금 확인되었습니다. 감사합니다.`);
    body.push(`차액 ${fmt(diff)}원이 남아 있어 안내드립니다. 편하실 때 마저 입금해 주시면 감사하겠습니다.`);
  } else if (mode === 'today') {
    body.push(`오늘(${it.promised_date ? mmdd(it.promised_date) : '금일'}) 결제 예정이신 ${fmt(amount)}원 안내드립니다.`);
    body.push(`편하실 때 입금해 주시면 감사하겠습니다.`);
  } else if (mode === 'broken') {
    body.push(`${it.promised_date ? mmdd(it.promised_date) : '지난'} 결제 예정이었던 ${fmt(amount)}원이 아직 확인되지 않아 다시 안내드립니다.`);
    body.push(`오늘 입금해 주실 수 있을까요? 일정이 변경되셨다면 편하신 날짜를 알려주시면 감사하겠습니다.`);
  } else {
    body.push(`현재 미수 잔액 ${fmt(amount)}원이 있어 안내드립니다.`);
    body.push(`편하실 때 입금해 주시면 감사하겠습니다. 입금 예정일을 알려주시면 일정에 맞춰 기다리겠습니다.`);
  }

  return [
    `안녕하세요, ${it.client_name} 담당자님\n${who}입니다.`,
    body.join('\n'),
    `▸ 입금 계좌: ${ACCOUNT[it.client_type] || ''}`,
    `늘 감사드립니다. 좋은 하루 보내세요.`,
  ].join('\n\n');
}
