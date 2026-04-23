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
