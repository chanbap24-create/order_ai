import { NextResponse } from 'next/server';
import { getClaudeClient } from '@/app/lib/claudeClient';

const ACCOUNT_CATEGORIES = [
  '복리후생비', '차량유지비', '여비교통비', '통신비', '접대비',
  '교육훈련비', '소모품비', '도서인쇄비', '운반비', '광고선전비',
  '지급수수료', '포장비', '견본비', '비품', '외주용역비',
];

export async function POST(request: Request) {
  try {
    const { image } = await request.json();
    if (!image) {
      return NextResponse.json({ error: '이미지가 없습니다.' }, { status: 400 });
    }

    // base64 데이터에서 prefix 제거
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    const mediaType = image.match(/^data:(image\/[a-z]+);base64,/)?.[1] || 'image/jpeg';

    const claude = getClaudeClient();
    const resp = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: `이 영수증/카드전표 이미지를 분석해서 다음 정보를 JSON으로 추출해주세요.

1. date: 사용일자 (YYYY-MM-DD 형식). 날짜를 찾을 수 없으면 오늘 날짜 사용.
2. description: 사용내역 (가맹점명/상호명 + 간단한 내용). 예: "스타벅스 코엑스점 커피", "GS칼텍스 주유"
3. amount: 금액 (숫자만, 콤마 없이). 합계/총액/승인금액 우선.
4. account_category: 아래 계정과목 중 가장 적합한 것 하나 선택.

계정과목 목록: ${ACCOUNT_CATEGORIES.join(', ')}

추천 기준:
- 식당/카페/음식 → 복리후생비 (사내) 또는 접대비 (거래처)
- 주유/톨게이트/주차 → 차량유지비
- 택시/KTX/버스/항공 → 여비교통비
- 사무용품/문구 → 소모품비
- 택배/배송 → 운반비

확실하지 않으면 복리후생비로 기본 설정.

반드시 아래 JSON 형식으로만 응답:
{"date":"2026-03-01","description":"상호명 내용","amount":15000,"account_category":"복리후생비","confidence":0.9}`,
            },
          ],
        },
      ],
    });

    const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
    // JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: '파싱 실패: JSON을 추출할 수 없습니다.', raw: text }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      date: parsed.date || '',
      description: parsed.description || '',
      amount: Number(parsed.amount) || 0,
      account_category: parsed.account_category || '복리후생비',
      confidence: parsed.confidence ?? 0.8,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: '서버 오류: ' + message }, { status: 500 });
  }
}
