# API Route 405 에러 추가 해결 방법

## 1. Next.js API Routes 파일 구조 확인
route.ts 파일은 다음과 같아야 합니다:
- 위치: app/api/parse-full-order/route.ts
- export async function POST(req: Request) { ... }
- export async function GET() { ... }

## 2. Vercel Function 크기 확인
route.ts 파일이 너무 크면 Vercel이 배포를 실패할 수 있습니다.
현재 파일 크기: ~23KB (정상 범위)

## 3. 런타임 설정 확인
export const runtime = "nodejs"; // ✅ 올바름

## 4. Edge Runtime 문제
혹시 edge runtime을 사용 중이라면 일부 기능이 제한될 수 있습니다.
현재는 nodejs runtime 사용 중이므로 문제없음.

## 5. Middleware 간섭 확인
middleware.ts 파일이 있다면 API 라우트를 차단할 수 있습니다.
