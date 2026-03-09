import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getClaudeClient } from '@/app/lib/claudeClient';

const MODEL = 'claude-haiku-4-5-20251001';

export async function POST(req: NextRequest) {
  try {
    const { client_code, client_name, order_text, tab } = await req.json();

    if (!order_text?.trim()) {
      return NextResponse.json({ error: '발주 내용을 입력해주세요.' }, { status: 400 });
    }

    // 1. 와인 리스트
    const table = tab === 'DL' ? 'inventory_dl' : 'inventory_cdv';
    const { data: wines, error: wineErr } = await supabase
      .from(table)
      .select('item_no, item_name, supply_price, available_stock')
      .order('item_no', { ascending: true });
    if (wineErr) throw wineErr;

    // 2. 거래처 입고내역 (CDV/DL 테이블 분리)
    let purchaseHistory: any[] = [];
    if (client_code) {
      const statsTable = tab === 'DL' ? 'glass_client_item_stats' : 'client_item_stats';
      const { data: stats } = await supabase
        .from(statsTable)
        .select('item_no, item_name')
        .eq('client_code', client_code)
        .limit(100);
      purchaseHistory = stats || [];
    }

    // 3. 와인 리스트 텍스트 (품번|품명)
    const wineListText = (wines || []).map(w =>
      `${w.item_no}|${w.item_name}`
    ).join('\n');

    // 4. 입고내역 텍스트
    const historyText = purchaseHistory.length > 0
      ? purchaseHistory.map(h => `${h.item_no}|${h.item_name}`).join('\n')
      : '';

    // 5. 프롬프트 - 후보군 3개씩 반환
    const systemPrompt = `와인 발주 파싱. 발주 메시지에서 와인명+수량 추출 후 와인리스트에서 후보 매칭.

규칙:
- 각 주문 항목마다 후보를 최대 5개 반환 (가장 유사한 순)
- 거래처 입고내역 우선 참고 (이전 구매 와인)
- 약어/줄임말/오타 해석 (돔페→돔페리뇽, 까브→까브드뱅)
- 수량 미명시→1
- 빈티지 명시→해당 빈티지 우선
- 색상 구분 필수: 블랑코/브랑코/비앙코/blanc/branco/bianco=화이트, 틴토/로쏘/rouge/rosso/tinto=레드, 로제/rosé/rosato=로제. 색상이 명시되면 반드시 해당 색상 와인 우선
- 글라스: 동일 모델의 일반/레스토랑 버전이 모두 있으면 반드시 둘 다 후보에 포함 (예: 6884/0 퍼포먼스 + 0884/0 퍼포먼스 레스토랑)
- 2nd/전시 버전은 후보에서 제외
- confidence: 0.9+=확실, 0.7~0.9=높음, 0.5~0.7=중간, <0.5=불확실

거래처: ${client_name || '미지정'}${client_code ? ` (${client_code})` : ''}
${historyText ? `\n입고내역(품번|품명):\n${historyText}\n` : ''}
와인리스트(품번|품명):
${wineListText}

JSON배열만 응답. 텍스트 없이. item_no는 와인리스트에 있는 품번을 정확히 복사:
[{"query":"원문","quantity":수량,"candidates":[{"item_no":"품번","item_name":"품명","confidence":0~1,"reasoning":"근거"}]}]
없으면 []`;

    // 6. Claude API 호출
    const claude = getClaudeClient();
    const response = await claude.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: order_text.trim() }
      ],
    });

    // 7. 응답 파싱
    const text = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    let parsed: any[] = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      return NextResponse.json({
        error: 'AI 응답을 파싱할 수 없습니다.',
        raw: text,
      }, { status: 500 });
    }

    // 8. 와인맵으로 가격/재고 보강 (trim + 대소문자 무시)
    const wineMap = new Map((wines || []).map(w => [w.item_no.trim().toUpperCase(), w]));

    const orderLines = parsed.map((p: any) => {
      const candidates = (p.candidates || []).map((c: any) => {
        const key = (c.item_no || '').trim().toUpperCase();
        const wine = wineMap.get(key);
        return {
          item_no: wine?.item_no || (c.item_no || '').trim(),
          item_name: wine?.item_name || c.item_name || '',
          confidence: Number(c.confidence) || 0,
          supply_price: wine?.supply_price || 0,
          available_stock: wine?.available_stock || 0,
          reasoning: c.reasoning || '',
        };
      });
      return {
        query: p.query || '',
        quantity: Number(p.quantity) || 1,
        candidates,
      };
    });

    const usage = {
      input_tokens: response.usage?.input_tokens || 0,
      output_tokens: response.usage?.output_tokens || 0,
    };

    // 구매이력 품번 Set
    const historyItemNos = purchaseHistory.map(h => h.item_no);

    return NextResponse.json({
      orderLines,
      usage,
      model: MODEL,
      client: { client_code, client_name },
      historyItemNos,
    });
  } catch (error: any) {
    console.error('Order v2 parse error:', error);
    return NextResponse.json(
      { error: error.message || '파싱 중 오류가 발생했습니다.', detail: String(error) },
      { status: 500 }
    );
  }
}
