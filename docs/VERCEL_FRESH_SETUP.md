# 🚀 Vercel 완전 새로 배포 가이드

## ⚠️ 기존 프로젝트 삭제 (선택사항)

기존에 Vercel 프로젝트가 있다면:

1. https://vercel.com/dashboard 접속
2. 기존 `order-ai` 프로젝트 찾기
3. Settings → General → 맨 아래 "Delete Project" 클릭
4. 프로젝트 이름 입력하여 삭제 확인

---

## ✨ 새 프로젝트 생성

### 1단계: Vercel 로그인

1. https://vercel.com 접속
2. **"Continue with GitHub"** 클릭

### 2단계: 새 프로젝트 Import

1. **"Add New..."** → **"Project"** 클릭
2. **"Import Git Repository"** 섹션에서
3. GitHub 저장소 검색: `order-ai`
4. **"Import"** 버튼 클릭

> 💡 저장소가 안 보이면: "Adjust GitHub App Permissions" → 저장소 접근 권한 부여

### 3단계: 프로젝트 설정 (중요!)

#### Configure Project 화면:

**Framework Preset**
- ✅ Next.js (자동 감지됨)

**Root Directory** 
- ✅ `./` (그대로 유지)

**Build and Output Settings**
- Build Command: `npm run build` (자동)
- Output Directory: `.next` (자동)
- Install Command: `npm install` (자동)

#### ⚠️ 중요 설정 변경:

**"Build & Development Settings"** 펼치기
- Node.js Version: **20.x** 선택 (기본값 사용)

### 4단계: 환경 변수 설정 ⭐ 필수!

**Environment Variables** 섹션에서 추가:

| Key | Value | Environment |
|-----|-------|-------------|
| `OPENAI_API_KEY` | `your_api_key_here` | Production, Preview, Development |
| `ENABLE_TRANSLATION` | `false` | Production, Preview, Development |
| `DB_PATH` | `./data.sqlite3` | Production, Preview, Development |
| `ORDER_AI_XLSX_PATH` | `./order-ai.xlsx` | Production, Preview, Development |

> 💡 `ENABLE_TRANSLATION=false`로 설정하면 OpenAI API 키가 없어도 작동합니다!

**환경 변수 추가 방법:**
1. "Environment Variables" 섹션 찾기
2. Key 입력 (예: `OPENAI_API_KEY`)
3. Value 입력
4. Environment 선택: **Production, Preview, Development 모두 선택**
5. "Add" 클릭
6. 나머지 변수들도 반복

### 5단계: 배포 시작

1. 모든 설정 확인
2. **"Deploy"** 버튼 클릭
3. 빌드 로그 확인 (2-5분 소요)

### 6단계: 배포 성공 확인

배포가 완료되면:
- ✅ 축하 메시지와 URL 표시
- ✅ 프로덕션 URL: `https://order-ai-xxxx.vercel.app`

---

## 🧪 테스트

### 기본 동작 확인

1. **홈페이지 접속**
   ```
   https://order-ai-xxxx.vercel.app
   ```

2. **API 상태 확인** (GET 요청)
   ```
   https://order-ai-xxxx.vercel.app/api/parse-full-order
   ```
   
   예상 응답:
   ```json
   {
     "success": true,
     "message": "parse-full-order API is running..."
   }
   ```

3. **POST 요청 테스트** (개발자 도구 Console에서)
   ```javascript
   fetch('/api/parse-full-order', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ 
       message: '샤블리 6병' 
     })
   })
   .then(r => r.json())
   .then(console.log)
   ```

---

## 🔧 문제 해결

### 빌드 실패 시

**1. Build Logs 확인**
- Deployments → 실패한 배포 클릭 → Build Logs

**2. 일반적인 문제:**

#### "Missing OPENAI_API_KEY" 에러
- 환경 변수 제대로 설정되지 않음
- Settings → Environment Variables → 다시 추가

#### "Module not found" 에러
- `package.json` dependencies 확인
- Redeploy 시도

#### "Build timeout" 에러
- Vercel 빌드 제한 (무료: 45초)
- Pro 플랜으로 업그레이드 또는 빌드 최적화

### 405 Method Not Allowed 에러

**이 문제가 다시 발생하면:**

1. **Deployments** 탭
2. 최신 배포 → **⋯** → **Redeploy**
3. ❗ **"Use existing Build Cache" 체크 해제**
4. **Redeploy** 클릭

### Runtime 에러

**Runtime Logs 확인:**
1. Deployments → 배포 클릭
2. "Functions" 탭
3. 각 API 라우트 로그 확인

---

## 📊 Vercel 대시보드 주요 메뉴

### Deployments
- 모든 배포 이력
- 빌드 로그, Runtime 로그
- Redeploy 기능

### Settings
- **Environment Variables**: 환경 변수 관리
- **Domains**: 커스텀 도메인 설정
- **General**: 프로젝트 기본 설정
- **Git**: GitHub 연동 설정

### Analytics
- 방문자 통계
- 성능 모니터링

---

## ✅ 완료 체크리스트

배포 완료 후 확인:

- [ ] 홈페이지 접속 성공
- [ ] `/api/parse-full-order` GET 요청 성공
- [ ] POST 요청으로 발주 파싱 테스트 성공
- [ ] 개발자 도구 Console에 405 에러 없음
- [ ] Network 탭에서 API 응답 200 OK 확인

---

## 🎯 참고 사항

### Vercel 무료 플랜 제한

- 빌드 시간: 45초
- 실행 시간: 10초
- 대역폭: 100GB/월
- 배포 횟수: 무제한

### 업그레이드가 필요한 경우

- 빌드가 45초 이상 걸림
- API 응답이 10초 이상 걸림
- 트래픽이 많음

---

## 📞 추가 도움말

**Vercel 공식 문서:**
- https://vercel.com/docs
- https://vercel.com/docs/frameworks/nextjs

**Next.js App Router:**
- https://nextjs.org/docs/app

**문제가 계속되면:**
1. Vercel Support (Pro 플랜)
2. GitHub Issues
3. Vercel Community Discord

---

**최종 업데이트:** 2026-01-12
