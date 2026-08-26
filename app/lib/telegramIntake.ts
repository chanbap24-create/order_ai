import { supabase } from './db';
import { fetchAllRows } from './fetchAll';
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

/** 수량/단위 등 품목 매칭에서 제외할 토큰 */
const STOP_TOKENS = new Set(['병', '개', '박스', '케이스', 'cs', 'ea', 'btl', '발주', '부탁드립니다', '부탁드려요', '주세요', '보내주세요', '안녕하세요']);

/** 발주 라인 → 의미 토큰 추출 (숫자·수량단위 제거, 2자+ 한글/영문) */
function lineTokens(line: string): string[] {
  return line.toLowerCase()
    .replace(/[0-9]+(병|개|박스|케이스|cs|ea|btl)?/g, ' ')
    .split(/[\s,./()"'x×*-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_TOKENS.has(t));
}

/**
 * 미지정 발주의 거래처 후보 — 담당자 최근 60일 출고 기준.
 * 점수 = (발주문 품목이 실제 나갔던 거래처 가점 ×100) + 출고 거래일수(빈도).
 * 발주 라인 토큰(3자+ 1개 또는 2개 이상)이 출고 품명에 들어 있으면 그 거래처를 품목 매칭으로 본다.
 */
export async function candidateClients(
  manager: string, orderText: string, limit = 6,
): Promise<Array<{ client_code: string; client_name: string }>> {
  const since = new Date(Date.now() + 9 * 3600 * 1000 - 60 * 86400000).toISOString().slice(0, 10);
  const ships = await fetchAllRows<{ client_code: string; client_name: string; item_name: string | null; ship_date: string }>((f, t) =>
    supabase.from('shipments')
      .select('client_code, client_name, item_name, ship_date')
      .eq('manager', manager).gte('ship_date', since)
      .order('ship_date', { ascending: false }).range(f, t));

  // 발주 라인별 토큰
  const lines = orderText.split('\n').map(lineTokens).filter((ts) => ts.length > 0);

  type Cand = { client_name: string; itemHits: number; days: Set<string>; lastDate: string };
  const byClient = new Map<string, Cand>();
  const lineHitByClient = new Map<string, Set<number>>(); // 같은 라인 중복 가점 방지

  for (const s of ships) {
    const code = String(s.client_code || '');
    if (!code || !s.client_name) continue;
    let c = byClient.get(code);
    if (!c) { c = { client_name: String(s.client_name), itemHits: 0, days: new Set(), lastDate: s.ship_date }; byClient.set(code, c); }
    c.days.add(s.ship_date);

    // 품목 매칭: 발주 라인 토큰이 이 출고 품명에 포함되는가
    const itemName = String(s.item_name || '').toLowerCase().replace(/\s+/g, '');
    if (!itemName) continue;
    lines.forEach((tokens, li) => {
      const hit = lineHitByClient.get(code);
      if (hit?.has(li)) return;
      const matched = tokens.filter((t) => itemName.includes(t.replace(/\s+/g, '')));
      const strong = matched.some((t) => t.length >= 3) || matched.length >= 2;
      if (strong) {
        c!.itemHits += 1;
        if (!lineHitByClient.has(code)) lineHitByClient.set(code, new Set());
        lineHitByClient.get(code)!.add(li);
      }
    });
  }

  return [...byClient.entries()]
    .map(([client_code, c]) => ({
      client_code, client_name: c.client_name,
      score: c.itemHits * 100 + c.days.size,
      lastDate: c.lastDate,
    }))
    .sort((a, b) => b.score - a.score || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit)
    .map(({ client_code, client_name }) => ({ client_code, client_name }));
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

  // 미지정 → 후보 버튼으로 질문 (탭 1번 확정). 다른 곳이면 이름 답장.
  const candidates = await candidateClients(manager, text);
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
