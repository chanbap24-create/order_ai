import { supabase } from "@/app/lib/db";
import { ERP_CUTOFF_CREATED_AT } from '@/app/lib/constants';
import { logger } from "@/app/lib/logger";
import type { PaymentRow, CarryoverRow } from "./types";

export async function processPaymentsFromData(payments: PaymentRow[], append = false, minDate?: string) {
  if (append && minDate) {
    // 누적 모드: minDate 이후 기존 데이터 삭제 후 재삽입
    await supabase.from('payments').delete().gte('payment_date', minDate);
    logger.info(`[Payments] Deleted payments >= ${minDate} (append mode)`);
  } else {
    // 전체 교체
    await supabase.from('payments').delete().not('id', 'is', null);
    logger.info(`[Payments] Cleared payments table`);
  }

  let inserted = 0;
  for (let i = 0; i < payments.length; i += 500) {
    const batch = payments.slice(i, i + 500);
    const { error } = await supabase.from('payments').insert(batch);
    if (error) {
      logger.error(`[Payments] insert error at batch ${i}`, { error });
      throw new Error(`payments insert failed: ${error.message}`);
    }
    inserted += batch.length;
  }

  logger.info(`[Payments] Inserted ${inserted} rows`);
  return { inserted };
}

export async function processCarryoverFromData(carryovers: CarryoverRow[], append = false) {
  if (!append) {
    await supabase.from('client_carryover').delete().not('id', 'is', null);
    logger.info(`[Carryover] Cleared client_carryover table`);
  }

  // client_code 중복 제거 (마지막 값 우선)
  const deduped = Array.from(
    carryovers.reduce((m, r) => m.set(r.client_code, r), new Map<string, CarryoverRow>()).values()
  );

  // created_at을 2025-08-01로 고정 (전산 전환 시점 = 이월 기준일)
  const batchData = deduped.map(r => ({ ...r, created_at: ERP_CUTOFF_CREATED_AT }));

  let inserted = 0;
  for (let i = 0; i < batchData.length; i += 500) {
    const batch = batchData.slice(i, i + 500);
    const { error } = await supabase.from('client_carryover').upsert(batch, { onConflict: 'client_code' });
    if (error) {
      logger.error(`[Carryover] insert error at batch ${i}`, { error });
      throw new Error(`carryover insert failed: ${error.message}`);
    }
    inserted += batch.length;
  }

  logger.info(`[Carryover] Inserted ${inserted} rows`);
  return { inserted };
}

export async function processDlPaymentsFromData(payments: PaymentRow[], append = false, minDate?: string) {
  if (append && minDate) {
    await supabase.from('glass_payments').delete().gte('payment_date', minDate);
    logger.info(`[DL-Payments] Deleted glass_payments >= ${minDate} (append mode)`);
  } else {
    await supabase.from('glass_payments').delete().not('id', 'is', null);
    logger.info(`[DL-Payments] Cleared glass_payments table`);
  }

  let inserted = 0;
  for (let i = 0; i < payments.length; i += 500) {
    const batch = payments.slice(i, i + 500);
    const { error } = await supabase.from('glass_payments').insert(batch);
    if (error) {
      logger.error(`[DL-Payments] insert error at batch ${i}`, { error });
      throw new Error(`glass_payments insert failed: ${error.message}`);
    }
    inserted += batch.length;
  }

  logger.info(`[DL-Payments] Inserted ${inserted} rows`);
  return { inserted };
}

export async function processDlCarryoverFromData(carryovers: CarryoverRow[], append = false) {
  if (!append) {
    await supabase.from('glass_client_carryover').delete().not('id', 'is', null);
    logger.info(`[DL-Carryover] Cleared glass_client_carryover table`);
  }

  const deduped = Array.from(
    carryovers.reduce((m, r) => m.set(r.client_code, r), new Map<string, CarryoverRow>()).values()
  );

  const batchData = deduped.map(r => ({ ...r, created_at: ERP_CUTOFF_CREATED_AT }));

  let inserted = 0;
  for (let i = 0; i < batchData.length; i += 500) {
    const batch = batchData.slice(i, i + 500);
    const { error } = await supabase.from('glass_client_carryover').upsert(batch, { onConflict: 'client_code' });
    if (error) {
      logger.error(`[DL-Carryover] insert error at batch ${i}`, { error });
      throw new Error(`glass_client_carryover insert failed: ${error.message}`);
    }
    inserted += batch.length;
  }

  logger.info(`[DL-Carryover] Inserted ${inserted} rows`);
  return { inserted };
}
