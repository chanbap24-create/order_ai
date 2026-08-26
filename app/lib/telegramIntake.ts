import { supabase } from './db';
import { sendTelegram, downloadTelegramFile, escapeHtml, answerCallback } from './telegram';
import { extractOrderFromImage } from './orderIntake';
import { getManagerClients } from './orderClients';
import { logger } from './logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IntakeResultRow = Record<string, any>;

// 텔레그램 봇으로 전달된 카톡 발주(텍스트/사진) → order-v2 수신함(order_intake) 저장 + 요약 회신.
// MVP: 저장·회신까지. 파싱·확정은 기존 order-v2 화면(수신함 → 파서)에서.

const ORDER_V2_URL = 'https://order-ai-one.vercel.app/order-v2';

/** 거래처명 대조용 정규화 — 공백·법인표기 제거 */
const normName = (s: string) =>
  s.toLowerCase().replace(/주식회사|\(주\)|㈜|\s+/g, '').trim();

/**
 * 발주 본문에서 담당 거래처 추정 (LLM 미사용).
 * 카톡 발주문은 "밍글스 발주입니다"처럼 서두에 거래처명이 오는 경우가 대부분 —
 * 첫 3줄을 담당 거래처 목록(학습 별칭 포함)과 포함 매칭. 와인명 오탐을 줄이기 위해 앞줄만 본다.
 */
export function guessClientFromText(
  text: string,
  clients: Array<{ client_code: string; client_name: string; aliases: string[] }>,
): { client_code: string; client_name: string } | null {
  const head = normName(text.split('\n').slice(0, 3).join(' '));
  if (!head) return null;
  let best: { client_code: string; client_name: string; len: number } | null = null;
  let ambiguous = false;
  for (const c of clients) {
    // 괄호 병기(예: '오일장(oiljang)', '브이오(VO)')는 괄호 제거 변형도 후보로
    const cands = [c.client_name, ...(c.aliases || [])];
    for (const raw of [...cands]) {
      const stripped = raw.replace(/\([^)]*\)/g, '').trim();
      if (stripped && stripped !== raw) cands.push(stripped);
    }
    for (const cand of cands) {
      const n = normName(cand);
      if (n.length < 2 || !head.includes(n)) continue;
      if (!best || n.length > best.len) {
        best = { client_code: c.client_code, client_name: c.client_name, len: n.length };
        ambiguous = false;
      } else if (n.length === best.len && c.client_code !== best.client_code) {
        ambiguous = true; // 같은 길이로 서로 다른 거래처 매칭 → 확정 보류
      }
    }
  }
  return best && !ambiguous ? { client_code: best.client_code, client_name: best.client_name } : null;
}

/** 담당자의 최근 출고 거래처 상위 N — 미지정 발주의 거래처 후보 버튼용 */
async function recentClients(manager: string, limit = 4): Promise<Array<{ client_code: string; client_name: string }>> {
  const { data } = await supabase.from('shipments')
    .select('client_code, client_name, ship_date')
    .eq('manager', manager)
    .order('ship_date', { ascending: false })
    .limit(300);
  const seen = new Map<string, string>();
  for (const r of data || []) {
    const code = String(r.client_code || '');
    if (code && r.client_name && !seen.has(code)) seen.set(code, String(r.client_name));
    if (seen.size >= limit) break;
  }
  return [...seen.entries()].map(([client_code, client_name]) => ({ client_code, client_name }));
}

/** 텍스트 발주 — 즉시 저장 + 거래처 추정. 미지정이면 후보 버튼으로 물어봄 */
export async function intakeTextOrder(manager: string, chatId: string, text: string): Promise<void> {
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);

  // 거래처 추정: 담당 거래처 목록 대조 (본문에 이름이 있는 경우만 — 대부분은 미지정)
  let guess: { client_code: string; client_name: string } | null = null;
  try {
    const clients = await getManagerClients(manager, 'CDV');
    guess = guessClientFromText(text, clients);
  } catch { /* 추정 실패해도 수신함 저장은 계속 */ }

  const { data: inserted, error } = await supabase.from('order_intake').insert({
    manager,
    tab: 'CDV',
    client_hint: guess?.client_name || null,
    order_text: text,
    // IntakeResult 형태 — client_code+confidence 를 주면 수신함 onLoad 가 거래처까지 자동 확정
    result: {
      found: true,
      order_text: text,
      client_hint: guess?.client_name || '',
      ...(guess ? { client_code: guess.client_code, client_name: guess.client_name, client_confidence: 0.9 } : {}),
    },
    status: 'pending',
  }).select('id').maybeSingle();
  if (error) {
    logger.warn(`[TelegramIntake] text insert failed: ${error.message}`);
    await sendTelegram(chatId, '⚠️ 수신함 저장에 실패했습니다. 잠시 후 다시 보내주세요.');
    return;
  }

  const preview = `<code>${escapeHtml(lines.slice(0, 3).join('\n'))}${lines.length > 3 ? '\n…' : ''}</code>`;

  if (guess) {
    await sendTelegram(chatId, [
      `📥 <b>${escapeHtml(guess.client_name)}</b> · ${lines.length}줄 수신함에 담았습니다`,
      preview,
      `<a href="${ORDER_V2_URL}">order-v2에서 파싱·확정하기</a>`,
    ].join('\n'));
    return;
  }

  // 미지정 → 최근 거래처 버튼으로 질문 (탭 1번 확정). 다른 곳이면 이름 답장.
  const candidates = await recentClients(manager);
  await sendTelegram(chatId, [
    `📥 ${lines.length}줄 수신함에 담았습니다 — <b>어느 거래처인가요?</b>`,
    preview,
    `아래 버튼을 누르거나, 거래처명을 답장으로 보내주세요.`,
  ].join('\n'), {
    reply_markup: {
      inline_keyboard: candidates.map((c) => ([{
        text: c.client_name.slice(0, 30),
        callback_data: `i:${inserted?.id}:${c.client_code}`,
      }])),
    },
  });
}

/** 버튼/답장으로 거래처 확정 — intake row 에 거래처 반영 */
async function assignClient(intakeId: number, manager: string, client: { client_code: string; client_name: string }): Promise<boolean> {
  const { data: row } = await supabase.from('order_intake')
    .select('id, result').eq('id', intakeId).eq('manager', manager).maybeSingle();
  if (!row) return false;
  const result: IntakeResultRow = { ...(row.result as IntakeResultRow || {}) };
  result.client_hint = client.client_name;
  result.client_code = client.client_code;
  result.client_name = client.client_name;
  result.client_confidence = 0.95;
  const { error } = await supabase.from('order_intake')
    .update({ client_hint: client.client_name, result }).eq('id', intakeId);
  return !error;
}

/** 인라인 버튼 콜백 처리 — callback_data "i:<intakeId>:<clientCode>" */
export async function handleClientCallback(manager: string, chatId: string, callbackId: string, data: string): Promise<void> {
  const m = data.match(/^i:(\d+):(.+)$/);
  if (!m) { await answerCallback(callbackId); return; }
  const intakeId = Number(m[1]);
  const clientCode = m[2];
  const clients = await getManagerClients(manager, 'CDV');
  const client = clients.find((c) => c.client_code === clientCode);
  if (!client) { await answerCallback(callbackId, '거래처를 찾지 못했습니다'); return; }
  const ok = await assignClient(intakeId, manager, client);
  await answerCallback(callbackId, ok ? `${client.client_name} 확정` : '반영 실패');
  if (ok) {
    await sendTelegram(chatId, [
      `✅ <b>${escapeHtml(client.client_name)}</b>(으)로 확정했습니다`,
      `<a href="${ORDER_V2_URL}">order-v2에서 파싱·확정하기</a>`,
    ].join('\n'));
  }
}

/**
 * 짧은 답장(거래처명)을 최근 미지정 발주에 연결.
 * @returns true = 거래처명으로 처리됨(발주문 아님)
 */
export async function tryAssignByReply(manager: string, chatId: string, text: string): Promise<boolean> {
  // 최근 15분 내 거래처 미지정 pending intake 가 있어야 답장 모드로 해석
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: pend } = await supabase.from('order_intake')
    .select('id, result').eq('manager', manager).eq('status', 'pending')
    .is('client_hint', null).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!pend) return false;

  const clients = await getManagerClients(manager, 'CDV');
  const hit = guessClientFromText(text, clients);
  if (!hit) {
    await sendTelegram(chatId, `"${escapeHtml(text)}" 와 일치하는 담당 거래처를 찾지 못했습니다. 정확한 상호로 다시 보내주세요.`);
    return true; // 답장 시도로 소비 (발주문으로 오인 저장 방지)
  }
  const ok = await assignClient(pend.id, manager, hit);
  await sendTelegram(chatId, ok
    ? `✅ <b>${escapeHtml(hit.client_name)}</b>(으)로 확정했습니다\n<a href="${ORDER_V2_URL}">order-v2에서 파싱·확정하기</a>`
    : '⚠️ 반영에 실패했습니다. 화면에서 선택해 주세요.');
  return true;
}

/** 사진 발주 — 기존 iOS 단축어와 동일 파이프라인(비전 추출) 재사용 */
export async function intakePhotoOrder(manager: string, chatId: string, fileId: string): Promise<void> {
  const file = await downloadTelegramFile(fileId);
  if (!file) {
    await sendTelegram(chatId, '⚠️ 사진을 받지 못했습니다. 다시 보내주세요.');
    return;
  }
  try {
    const clients = await getManagerClients(manager, 'CDV');
    const result = await extractOrderFromImage(file.buf.toString('base64'), file.mime, clients);
    const lines = String(result.order_text || '').split('\n').map((s) => s.trim()).filter(Boolean);

    await supabase.from('order_intake').insert({
      manager,
      tab: 'CDV',
      client_hint: result.client_hint || null,
      order_text: result.order_text || null,
      result,
      status: result.found ? 'pending' : 'failed',
    });

    if (result.found) {
      await sendTelegram(chatId, [
        `📥 <b>${escapeHtml(result.client_hint || '거래처 미상')}</b> · ${lines.length}줄 인식`,
        lines.length ? `<code>${escapeHtml(lines.slice(0, 3).join('\n'))}${lines.length > 3 ? '\n…' : ''}</code>` : '',
        `<a href="${ORDER_V2_URL}">order-v2에서 파싱·확정하기</a>`,
      ].filter(Boolean).join('\n'));
    } else {
      await sendTelegram(chatId, '사진에서 발주 내용을 인식하지 못했습니다. 텍스트로 보내시면 더 정확합니다.');
    }
  } catch (e) {
    logger.warn(`[TelegramIntake] photo failed: ${e instanceof Error ? e.message : e}`);
    await sendTelegram(chatId, '⚠️ 사진 분석에 실패했습니다. 텍스트로 보내주세요.');
  }
}
