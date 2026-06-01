export type OutstandingType = 'wine' | 'glass';

export interface OutstandingClient {
  client_code: string;
  client_name: string;
  prev_balance: number;
  period_supply: number;
  period_tax: number;
  period_total: number;
  period_payment: number;
  outstanding: number;
}

export interface OutstandingTotals {
  prev_balance: number;
  period_supply: number;
  period_tax: number;
  period_total: number;
  period_payment: number;
  outstanding: number;
}

// ── 미수금 연령 분석(Aging) — 달력 월 경과 기준(당월/1·2·3개월+) ──
export interface AgingClient {
  client_code: string;
  client_name: string;
  net_balance: number;
  b_cur: number;    // 당월
  b_m1: number;     // 1개월 경과
  b_m2: number;     // 2개월 경과
  b_m3: number;     // 3개월 이상 경과
  oldest_unpaid_date: string | null;
  last_payment_date: string | null;
  last_payment_amount: number;  // 최근 수금 1건 금액
  paid_90d: number;             // 최근 3개월(90일) 수금 합계
  overdue: number;              // 결제조건(수금일) 기준 예정일이 지난 미수
}

export type FollowupStatus = 'open' | 'promised' | 'paid' | 'hold';

export interface Followup {
  client_code: string;
  client_type: OutstandingType;
  stage: number;            // 0=없음, 1/2/3 독촉 차수
  status: FollowupStatus;
  promised_date: string | null;
  promised_amount: number | null;  // 수금 약속 금액
  memo: string | null;
  payment_type: import('../lib/dueDate').PaymentType | null;  // 결제 조건(수금일)
  updated_at?: string;
}

// aging 행 + 해당 거래처 followup 병합
export interface AgingRow extends AgingClient {
  followup?: Followup;
}
