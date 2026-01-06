# 🚀 Order AI - Vercel 배포 가이드

## ✅ 준비 완료

프로젝트가 Vercel 배포를 위해 준비되었습니다:
- ✅ `vercel.json` 설정 파일 생성
- ✅ `.vercelignore` 파일 생성
- ✅ README에 배포 가이드 추가
- ✅ GitHub 저장소에 푸시 완료

## 📋 Vercel 배포 단계별 가이드

### 1️⃣ Vercel 웹사이트 접속 및 로그인

1. https://vercel.com 접속
2. **"Sign Up"** 또는 **"Login"** 클릭
3. **"Continue with GitHub"** 선택하여 GitHub 계정으로 로그인

### 2️⃣ 새 프로젝트 생성

1. 대시보드에서 **"Add New..."** 버튼 클릭
2. **"Project"** 선택
3. GitHub 저장소 목록에서 **"order-ai"** 찾기
   - 목록에 없다면 하단의 **"Adjust GitHub App Permissions"** 클릭하여 저장소 접근 권한 부여

### 3️⃣ 프로젝트 설정

**Import Project 화면에서:**

- **Framework Preset**: Next.js (자동 감지됨)
- **Root Directory**: `./` (그대로 유지)
- **Build Command**: `npm run build` (자동 설정됨)
- **Output Directory**: `.next` (자동 설정됨)
- **Install Command**: `npm install` (자동 설정됨)

### 4️⃣ 환경 변수 설정 ⭐ 중요!

**Environment Variables** 섹션에서 다음을 추가하세요:

| Name | Value | 설명 |
|------|-------|------|
| `OPENAI_API_KEY` | `your_openai_api_key_here` | OpenAI API 키 (필수) |
| `ENABLE_TRANSLATION` | `true` | 영어 번역 활성화 (선택) |
| `ORDER_AI_XLSX_PATH` | `./order-ai.xlsx` | 엑셀 파일 경로 |
| `DB_PATH` | `./data.sqlite3` | SQLite DB 경로 |

**추가 방법:**
1. "Name" 칸에 변수명 입력 (예: `OPENAI_API_KEY`)
2. "Value" 칸에 값 입력
3. "Add" 버튼 클릭
4. 모든 환경 변수 추가 완료 후 다음 단계로

### 5️⃣ 배포 시작

1. **"Deploy"** 버튼 클릭
2. 빌드 진행 상황 확인 (약 2-5분 소요)
3. 배포 완료되면 축하 화면과 함께 URL이 표시됩니다

### 6️⃣ 배포 확인

배포가 완료되면 다음 URL에서 접근 가능합니다:

- **프로덕션 URL**: `https://order-ai-<random>.vercel.app`
- **자동 생성된 URL**: 프로젝트마다 고유한 URL

### 7️⃣ 테스트

1. 배포된 URL 접속
2. 발주 메시지 입력 테스트
3. API 엔드포인트 확인:
   - `/api/parse-full-order`
   - `/api/resolve-client`
   - `/api/parse-order`

## 🔄 자동 배포 설정

Vercel은 GitHub와 자동 연동됩니다:

- ✅ `main` 브랜치에 푸시하면 자동으로 프로덕션 배포
- ✅ 다른 브랜치에 푸시하면 미리보기 배포 생성
- ✅ Pull Request 생성 시 자동 미리보기 URL 생성

## ⚠️ 중요 참고사항

### SQLite 제한사항

Vercel의 Serverless Functions 환경에서:
- ✅ **읽기 작업**: 정상 작동
- ⚠️ **쓰기 작업**: 재배포 시 초기화됨 (영구 저장 안 됨)

### 데이터 영구 저장이 필요한 경우

만약 사용자 데이터를 영구적으로 저장해야 한다면:

1. **Vercel Postgres** 사용 (권장)
   - https://vercel.com/docs/storage/vercel-postgres
   
2. **외부 데이터베이스** 연결
   - Supabase
   - PlanetScale
   - MongoDB Atlas

3. **Vercel KV** (Redis)
   - 간단한 키-값 저장용

## 🛠️ 배포 후 관리

### 환경 변수 수정

1. Vercel 대시보드 → 프로젝트 선택
2. **Settings** → **Environment Variables**
3. 변수 수정 후 **Save**
4. **Deployments** 탭에서 **Redeploy** 클릭

### 로그 확인

1. **Deployments** 탭
2. 최근 배포 클릭
3. **Runtime Logs** 확인

### 커스텀 도메인 설정

1. **Settings** → **Domains**
2. 도메인 입력 후 DNS 설정
3. Vercel이 자동으로 SSL 인증서 발급

## 📞 문제 해결

### 배포 실패 시

1. **Build Logs** 확인
2. 환경 변수 설정 확인
3. `package.json` dependencies 확인
4. Node.js 버전 호환성 확인

### API 오류 시

1. **Runtime Logs** 확인
2. `OPENAI_API_KEY` 환경 변수 확인
3. API 엔드포인트 URL 확인

## 🎉 완료!

이제 Order AI가 Vercel에서 실행되고 있습니다!

배포 URL을 README.md의 프로젝트 URL 섹션에 업데이트하는 것을 잊지 마세요.

---

**GitHub 저장소**: https://github.com/chanbap24-create/order-ai

**Vercel 공식 문서**: https://vercel.com/docs
