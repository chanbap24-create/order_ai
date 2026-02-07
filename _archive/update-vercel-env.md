# Vercel CLI로 환경 변수 업데이트하기

## 1. Vercel CLI 설치 (로컬에서)
```bash
npm install -g vercel
```

## 2. Vercel 로그인
```bash
vercel login
```

## 3. 환경 변수 업데이트
```bash
# Production 환경
vercel env add OPENAI_API_KEY production

# 프롬프트가 나오면 새 API 키 입력
# 입력 후 Enter

# Preview 환경
vercel env add OPENAI_API_KEY preview

# Development 환경
vercel env add OPENAI_API_KEY development
```

## 4. 재배포
```bash
vercel --prod
```

---

## 더 간단한 방법: 웹 대시보드 사용
위 CLI 방법이 복잡하다면, 그냥 Vercel 웹사이트에서:
1. https://vercel.com/dashboard
2. 프로젝트 → Settings → Environment Variables
3. OPENAI_API_KEY 수정
4. Deployments → Redeploy (Build Cache 비활성화)

이 방법이 훨씬 쉽고 안전합니다!
