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

// ── 미수금 연령 분석(Aging) ──
export interface AgingClient {
  client_code: string;
  client_name: string;
  net_balance: number;
  b_0_30: number;
  b_31_60: number;
  b_61_90: number;
  b_90plus: number;
  oldest_unpaid_date: string | null;
  last_payment_date: string | null;
}

export type FollowupStatus = 'open' | 'promised' | 'paid' | 'hold';

export interface Followup {
  client_code: string;
  client_type: OutstandingType;
  stage: number;            // 0=없음, 1/2/3 독촉 차수
  status: FollowupStatus;
  promised_date: string | null;
  memo: string | null;
  updated_at?: string;
}

// aging 행 + 해당 거래처 followup 병합
export interface AgingRow extends AgingClient {
  followup?: Followup;
}
