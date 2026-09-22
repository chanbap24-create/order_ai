import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';
import { matchLineV3 } from '@/app/lib/matcher-v3';
import { resolveItemsByClientWeighted } from '@/app/lib/resolveItemsWeighted';
import { handleApiError } from '@/app/lib/errors';

// 매처 v3 테스트 — 라인별로 v2(현행)·v3(임베딩) 동시 실행해 비교 결과 반환
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { lines, client_code } = await req.json();
    if (!Array.isArray(lines) || lines.length === 0 || lines.length > 20) {
      return NextResponse.json({ error: '라인 1~20개를 입력하세요.' }, { status: 400 });
    }
    const clean = lines.map((l: unknown) => String(l || '').trim()).filter(Boolean);

    // 거래처 인식 — 코드 또는 이름 입력 모두 지원. 해석된 코드는 v2·v3 양쪽에 동일하게 전달(공정 비교).
    let client: { code: string; name: string; historyItems: number } | null = null;
    let resolvedCode: string | null = null;
    if (client_code) {
      const raw = String(client_code).trim();
      if (/^\d{3,}$/.test(raw)) {
        const { data: c } = await supabase.from('clients').select('client_code, client_name').eq('client_code', raw).maybeSingle();
        if (c) { resolvedCode = raw; client = { code: raw, name: c.client_name || raw, historyItems: 0 }; }
      } else {
        // 이름 검색 — 공백 무시 매칭 우선, 다음 부분일치. 유일할 때만 채택.
        const collapsed = raw.replace(/\s+/g, '');
        const { data: cands } = await supabase.from('clients')
          .select('client_code, client_name').ilike('client_name', `%${raw.split(/\s+/).join('%')}%`).limit(5);
        const pool = (cands || []).length ? cands! : (
          (await supabase.from('clients').select('client_code, client_name').ilike('client_name', `%${collapsed}%`).limit(5)).data || []);
        const exact = pool.filter((c) => String(c.client_name || '').replace(/\s+/g, '').includes(collapsed));
        const pick = (exact.length ? exact : pool);
        if (pick.length >= 1) {
          resolvedCode = String(pick[0].client_code);
          client = { code: resolvedCode, name: pick[0].client_name || resolvedCode, historyItems: 0 };
        }
      }
      if (client) {
        const { count } = await supabase.from('shipments').select('*', { count: 'exact', head: true }).eq('client_code', client.code);
        client.historyItems = count || 0;
      }
    }

    // v2는 라인별 독립 실행 — 한 라인(비와인 텍스트 등)이 던져도 나머지 비교는 계속
    const [v3, v2] = await Promise.all([
      Promise.all(clean.map((l: string) => matchLineV3(l, resolvedCode))),
      Promise.all(clean.map((l: string) =>
        resolveItemsByClientWeighted(resolvedCode || '', [{ name: l, qty: 1 }])
          .then((r) => r[0] ?? null).catch(() => null))),
    ]);

    const rows = clean.map((line: string, i: number) => ({
      line,
      v2: v2[i] ? {
        item_no: v2[i].item_no ?? null, item_name: v2[i].item_name ?? null,
        score: v2[i].score ?? null,
        candidates: (v2[i].candidates || []).slice(0, 5),
      } : null,
      v3: v3[i],
      agree: !!(v2[i]?.item_no && v3[i].picked && String(v2[i].item_no) === v3[i].picked!.item_no),
    }));
    return NextResponse.json({ rows, client });
  } catch (e) {
    return handleApiError(e);
  }
}
