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
    // LLM 입력 길이 제한 (과도한 토큰 소비 방지)
    if (typeof order_text !== 'string' || order_text.length > 5000) {
      return NextResponse.json({ error: '발주 내용이 너무 깁니다. (최대 5000자)' }, { status: 400 });
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
      if (tab === 'DL') {
        // glass_shipments에서 직접 집계 (고유 품목)
        const { data: ships } = await supabase
          .from('glass_shipments')
          .select('item_no, item_name')
          .eq('client_code', client_code)
          .order('ship_date', { ascending: false })
          .limit(1000);
        const seen = new Set<string>();
        for (const s of (ships || [])) {
          if (s.item_no && !seen.has(s.item_no)) {
            seen.add(s.item_no);
            purchaseHistory.push({ item_no: s.item_no, item_name: s.item_name });
          }
        }
      } else {
        const { data: stats } = await supabase
          .from('client_item_stats')
          .select('item_no, item_name')
          .eq('client_code', client_code)
          .limit(100);
        purchaseHistory = stats || [];
      }
    }

    // 3. 와인 리스트 텍스트 (품번|품명)
    const wineListText = (wines || []).map(w =>
      `${w.item_no}|${w.item_name}`
    ).join('\n');

    // 4. 입고내역 텍스트
    const historyText = purchaseHistory.length > 0
      ? purchaseHistory.map(h => `${h.item_no}|${h.item_name}`).join('\n')
      : '';

    // 5. 프롬프트 - CDV(와인) / DL(글라스) 분리
    const systemPrompt = tab === 'DL'
      ? `리델 글라스 발주 파싱. 발주 메시지에서 글라스명/모델번호+수량 추출 후 리스트에서 후보 매칭.

규칙:
- 각 주문 항목마다 후보를 최대 5개 반환 (가장 유사한 순)
- 거래처 입고내역 우선 참고 (이전 구매 글라스)
- 핵심: 발주에서 "0884/67 6"처럼 모델번호+수량으로 올 수 있음. 이때 품명 안에 해당 모델번호가 포함된 품목을 매칭 (예: "0884/67"→품명에 "0884/67"이 포함된 항목)
- 모델번호 패턴: XXXX/XX 형식 (예: 6884/0, 0884/67, 4884/15D, 1490/13)
- 동일 모델의 일반/레스토랑 버전이 모두 있으면 반드시 둘 다 후보에 포함 (예: 6884/0 퍼포먼스 + 0884/0 퍼포먼스 레스토랑)
- 2nd/전시 버전은 후보에서 제외
- 수량 미명시→1
- 약어/줄임말 해석 (퍼포→퍼포먼스, 카베→카베르네, 피노→피노누아, 샴페→샴페인, 샤도→샤르도네, 소블→소비뇽 블랑, 시라→시라/시라즈, 리슬→리슬링)
- confidence: 0.9+=확실, 0.7~0.9=높음, 0.5~0.7=중간, <0.5=불확실

거래처: ${client_name || '미지정'}${client_code ? ` (${client_code})` : ''}
${historyText ? `\n입고내역(품번|품명):\n${historyText}\n` : ''}
글라스리스트(품번|품명):
${wineListText}

JSON배열만 응답. 텍스트 없이. item_no는 글라스리스트에 있는 품번을 정확히 복사:
[{"query":"원문","quantity":수량,"candidates":[{"item_no":"품번","item_name":"품명","confidence":0~1,"reasoning":"근거"}]}]
없으면 []`
      : `와인 발주 파싱. 발주 메시지에서 와인명+수량 추출 후 와인리스트에서 후보 매칭.

규칙:
- 각 주문 항목마다 후보를 최대 5개 반환 (가장 유사한 순)
- 거래처 입고내역 우선 참고 (이전 구매 와인)
- 약어/줄임말/오타 해석 (돔페→돔페리뇽, 까브→까브드뱅)
- 수량 미명시→1
- 빈티지 명시→해당 빈티지 우선
- 색상 구분 필수: 블랑코/브랑코/비앙코/blanc/branco/bianco=화이트, 틴토/로쏘/rouge/rosso/tinto=레드, 로제/rosé/rosato=로제. 색상이 명시되면 반드시 해당 색상 와인 우선
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

    // 입고예정 조회
    const { data: importSchedule } = await supabase
      .from('import_schedule')
      .select('item_code, arrival_date, total_btls')
      .gte('arrival_date', new Date().toISOString().slice(0, 10));
    const importMap = new Map<string, { arrival_date: string; total_btls: number }>();
    for (const is of (importSchedule || [])) {
      const key = (is.item_code || '').trim().toUpperCase();
      if (!importMap.has(key)) importMap.set(key, { arrival_date: is.arrival_date, total_btls: is.total_btls });
    }

    // 거래처 구매이력 품번 Set
    const historyItemNos = purchaseHistory.map(h => h.item_no);
    const historySet = new Set(historyItemNos.map(n => n.trim().toUpperCase()));

    // 품번에서 빈티지 제거한 "와인 기본키" 추출 (예: 3A24001 → 3Axx001 → 와인 "3A")
    // 품번 구조: 브랜드(2) + 빈티지(2) + 번호(3) → 같은 와인 = 브랜드 + 번호 동일
    const getWineBase = (itemNo: string): string => {
      const s = itemNo.trim();
      if (s.length >= 7) return s.slice(0, 2) + 'XX' + s.slice(4);
      return s;
    };

    const orderLines = parsed.map((p: any) => {
      const candidates = (p.candidates || []).map((c: any) => {
        const key = (c.item_no || '').trim().toUpperCase();
        const wine = wineMap.get(key);
        const imp = importMap.get(key);
        return {
          item_no: wine?.item_no || (c.item_no || '').trim(),
          item_name: wine?.item_name || c.item_name || '',
          confidence: Number(c.confidence) || 0,
          supply_price: wine?.supply_price || 0,
          available_stock: wine?.available_stock || 0,
          reasoning: c.reasoning || '',
          ...(imp ? { incoming: { arrival_date: imp.arrival_date, total_btls: imp.total_btls } } : {}),
        };
      });

      // ── 빈티지 자동 확정 로직 ──
      if (tab !== 'DL' && candidates.length > 1) {
        const first = candidates[0];
        const firstBase = getWineBase(first.item_no);

        // 같은 와인(브랜드+번호)의 다른 빈티지 후보 찾기
        const sameWineCands = candidates.filter((c: any) => getWineBase(c.item_no) === firstBase);

        if (sameWineCands.length > 1) {
          // 1) 거래처가 특정 빈티지를 구매한 이력이 있으면 그것을 우선 선택
          const historyMatch = sameWineCands.find((c: any) => historySet.has(c.item_no.trim().toUpperCase()));
          if (historyMatch) {
            const hIdx = candidates.indexOf(historyMatch);
            if (hIdx > 0) {
              // 해당 후보를 맨 앞으로
              candidates.splice(hIdx, 1);
              candidates.unshift(historyMatch);
              historyMatch.reasoning = (historyMatch.reasoning || '') + ' [거래처 구매이력 빈티지]';
            }
          } else {
            // 2) 이전 빈티지 재고 0이면 → 재고 있는 최신 빈티지 선택
            if (first.available_stock <= 0) {
              const withStock = sameWineCands.find((c: any) => c.available_stock > 0);
              if (withStock) {
                const wsIdx = candidates.indexOf(withStock);
                if (wsIdx > 0) {
                  candidates.splice(wsIdx, 1);
                  candidates.unshift(withStock);
                  withStock.reasoning = (withStock.reasoning || '') + ' [이전 빈티지 재고 없음→최신 빈티지]';
                }
              }
            }
          }
        }
      }

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
