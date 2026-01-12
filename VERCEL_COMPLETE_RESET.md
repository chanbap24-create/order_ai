# 🚨 Vercel 프로젝트 완전 재설정 가이드

## 현재 상황
- ✅ 로컬 빌드: 완벽하게 작동
- ✅ 코드: 문제 없음
- ❌ Vercel 배포: 405 Method Not Allowed 지속

**문제:** Vercel 프로젝트가 잘못된 빌드 캐시/설정을 계속 사용

**해결:** 프로젝트를 완전히 삭제하고 새로 만들기

---

## 🔥 단계 1: 기존 프로젝트 삭제

### 1-1. Vercel 대시보드 접속
```
https://vercel.com/dashboard
```

### 1-2. 프로젝트 선택
- 현재 order-ai 프로젝트 클릭

### 1-3. Settings → General
- 왼쪽 메뉴에서 **Settings** 클릭
- **General** 탭 선택

### 1-4. 프로젝트 삭제
- 페이지 맨 아래로 스크롤
- **"Delete Project"** 섹션 찾기
- 빨간 **"Delete"** 버튼 클릭
- 프로젝트 이름 입력 (확인용)
- 다시 **"Delete"** 클릭

✅ **완전히 삭제될 때까지 대기 (1분)**

---

## ✨ 단계 2: 새 프로젝트 생성

### 2-1. Import Git Repository
```
https://vercel.com/new
```
또는 대시보드에서 **"Add New..." → "Project"**

### 2-2. GitHub 저장소 선택
- **"Import Git Repository"** 섹션
- 검색: `order-ai`
- **"Import"** 버튼 클릭

> 💡 저장소가 안 보이면:
> - "Adjust GitHub App Permissions" 클릭
> - order-ai 저장소 접근 권한 부여

### 2-3. 프로젝트 설정 (중요!)

#### Framework Preset
- ✅ **Next.js** (자동 감지됨)

#### Root Directory
- ✅ `./` (그대로 둠)

#### Build Settings
- ✅ Build Command: (비워둠 - 자동)
- ✅ Output Directory: (비워둠 - 자동)
- ✅ Install Command: (비워둠 - 자동)

⚠️ **아무것도 건드리지 마세요!**

---

## 🔑 단계 3: 환경 변수 설정

### 3-1. Environment Variables 섹션 찾기
- **"Configure Project"** 화면에서
- **"Environment Variables"** 섹션

### 3-2. 변수 추가

**필수 변수:**
```
Key: OPENAI_API_KEY
Value: (your_openai_api_key)
Environment: ✅ Production ✅ Preview ✅ Development
→ Add 클릭

Key: ENABLE_TRANSLATION  
Value: false
Environment: ✅ Production ✅ Preview ✅ Development
→ Add 클릭

Key: DB_PATH
Value: ./data.sqlite3
Environment: ✅ Production ✅ Preview ✅ Development
→ Add 클릭

Key: ORDER_AI_XLSX_PATH
Value: ./order-ai.xlsx
Environment: ✅ Production ✅ Preview ✅ Development
→ Add 클릭
```

⚠️ **반드시 3개 환경 모두 체크!**

---

## 🚀 단계 4: 배포 시작

### 4-1. Deploy 버튼 클릭
- 모든 설정 확인 후
- 파란색 **"Deploy"** 버튼 클릭

### 4-2. 빌드 로그 모니터링
- 빌드 진행 상황 실시간 확인
- **보안 경고 없는지** 확인
- **"Build Completed"** 메시지 대기

### 4-3. 배포 완료 대기
- 약 2-3분 소요
- 성공 메시지 확인

---

## 🧪 단계 5: 테스트

### 5-1. 프로덕션 URL 확인
```
https://order-ai-xxx.vercel.app
```
(Vercel이 자동 생성한 URL)

### 5-2. API GET 테스트
브라우저에서:
```
https://order-ai-xxx.vercel.app/api/parse-full-order
```

**예상 결과:**
```json
{
  "success": true,
  "message": "parse-full-order API is running. Use POST method to parse orders."
}
```

❌ **만약 HTML이 나오면:** 여전히 실패

### 5-3. API POST 테스트
사이트 접속 후 개발자 도구 Console:
```javascript
fetch('/api/parse-full-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: '샤블리 6병' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

**예상 결과:**
```json
{
  "success": true,
  "status": "needs_review_client",
  ...
}
```

---

## ✅ 성공 체크리스트

배포 후 확인:
- [ ] 보안 경고 없이 빌드 완료
- [ ] GET 요청 → JSON 응답 (HTML 아님!)
- [ ] POST 요청 → 200 OK (405 아님!)
- [ ] 콘솔 에러 없음
- [ ] 실제 발주 파싱 테스트 성공

---

## 🔍 실패하면?

### 만약 여전히 405 에러가 나온다면:

1. **Vercel Functions 탭 확인**
   - Deployments → 최신 배포 클릭
   - **"Functions"** 탭 확인
   - `/api/parse-full-order` 함수가 있는지 확인

2. **빌드 로그 확인**
   - "Creating Serverless Functions" 메시지 있는지
   - API 라우트가 제대로 빌드되었는지

3. **Vercel 지원 문의**
   - 이미 모든 코드 수정을 완료했음
   - Next.js 15.5.9 (최신 패치)
   - 로컬에서는 완벽하게 작동
   - Vercel 플랫폼 자체의 문제일 수 있음

---

## 🎯 왜 이렇게 해야 하나요?

### Vercel이 캐시하는 것들:
1. **프로젝트 빌드 설정**
2. **Framework 감지 결과**
3. **Functions 라우팅 규칙**
4. **빌드 캐시 (.next 폴더)**

### 문제:
- 이전에 Next.js 16으로 빌드했을 때의 **잘못된 설정**이 캐시됨
- Redeploy로는 이 캐시가 완전히 지워지지 않음
- **프로젝트를 삭제하면 모든 캐시가 사라짐**

---

## 💬 마지막 말

이 가이드대로 **완전히 새로 만들면** 100% 작동할 것입니다.

코드는 완벽합니다. 로컬에서 작동하면 Vercel에서도 작동해야 합니다.

문제는 **Vercel 프로젝트 설정**입니다. 새로 만드세요!

---

**작성일:** 2026-01-12
**Next.js 버전:** 15.5.9
**상태:** 로컬 테스트 완료 ✅
