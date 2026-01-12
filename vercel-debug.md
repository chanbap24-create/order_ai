# 🔍 Vercel 405 에러 디버깅 체크리스트

## 현재 상황
- ✅ 로컬 빌드: 성공
- ✅ 로컬 서버: 정상 작동
- ✅ GitHub: 최신 코드 반영
- ❌ Vercel: 405 Method Not Allowed

## 가능한 원인들

### 1. Vercel 프로젝트 설정 문제 ⭐ (가장 가능성 높음)
```
증상: API 라우트가 HTML 페이지로 폴백됨
원인: Vercel이 Next.js App Router를 제대로 인식하지 못함
해결: 프로젝트 완전 재생성
```

### 2. Build Output 문제
```
증상: 빌드는 성공하지만 API 라우트가 배포되지 않음
원인: .next 폴더의 서버 파일이 Vercel에 업로드되지 않음
해결: Build Cache 완전 삭제 후 재배포
```

### 3. Vercel 플랫폼 버그
```
증상: Next.js 15.5.9와 Vercel 호환성 문제
원인: 최신 Next.js 버전의 버그
해결: Next.js 14로 다운그레이드 또는 Vercel 지원팀 문의
```

## 🎯 지금 시도해야 할 것 (우선순위)

### ✅ 즉시 시도 가능 (5분)
1. Vercel 대시보드에서 프로젝트 삭제
2. GitHub에서 다시 Import
3. 환경 변수만 설정하고 배포
4. 테스트

### ⚠️ 대안 (30분)
1. Next.js 14로 다운그레이드
2. 완전히 깨끗한 빌드
3. 배포 테스트

### 🆘 최후의 수단
1. Vercel 지원팀에 문의
2. 다른 플랫폼 고려 (Netlify, Railway, Render)

---

## 📞 Vercel 지원팀 문의 템플릿

Subject: API Routes returning 405 Method Not Allowed

Body:
```
Hello Vercel Support,

I'm experiencing a persistent 405 Method Not Allowed error with my Next.js 15.5.9 application.

- Framework: Next.js 15.5.9 (App Router)
- Project: order-ai
- Issue: POST requests to /api/parse-full-order return 405
- Response: HTML page instead of API response

What I've tried:
- Cleared build cache multiple times
- Deleted vercel.json
- Updated to latest Next.js
- Verified API routes work locally

Local build output confirms routes are built as Dynamic (ƒ).
Vercel build logs show success but API routes return HTML.

Could you please investigate if there's a platform issue with Next.js 15 App Router API routes?

Thank you!
```

