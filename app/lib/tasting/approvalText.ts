// 시음주 결재 요청 문구 생성(복사·붙여넣기용). 단건/다건 공용.
export interface ApprovalItem {
  item_name: string;
  supply: number; // 공급가(단가)
  qty: number;
}
export interface ApprovalInput {
  clientName: string;
  dept: string;
  user: string;
  position: string;
  payDate: string; // 예: '6/11'
  items: ApprovalItem[];
  extra: string; // 비고 추가문구(줄바꿈 가능)
}

const won = (n: number) => (n || 0).toLocaleString();

export function approvalTotal(items: ApprovalItem[]): number {
  return items.reduce((s, it) => s + (Number(it.supply) || 0) * (Number(it.qty) || 1), 0);
}

export function buildApprovalText(a: ApprovalInput): string {
  const title = `시음주 요청의건_${a.clientName}`;
  const total = approvalTotal(a.items);
  const rows = a.items.map((it) => `시음주\t${it.item_name}\t${won(it.supply)}\t${a.clientName}\t${it.qty}`);
  const note = [title, ...(a.extra || "").split("\n").map((x) => x.trim()).filter(Boolean), "-끝-"].join("\n");
  return [
    `제목: ${title}`,
    "",
    `사용부서: ${a.dept}\t사용자: ${a.user}\t직위: ${a.position}`,
    `발의금액: ${won(total)}\t지급일자: ${a.payDate}`,
    "",
    "[상세내역]",
    "계정과목\t품목\t금액(공급가)\t거래처명\t수량",
    ...rows,
    "",
    `합계: ${won(total)}`,
    "",
    "[비고]",
    note,
  ].join("\n");
}
