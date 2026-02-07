# 🚨 500 에러 긴급 해결 가이드

## 현재 상황
- 405 에러 → 500 에러로 변경됨
- 이는 진전입니다! (API 라우트가 인식되기 시작함)
- 하지만 서버에서 실행 중 에러 발생

## 🔍 500 에러의 주요 원인

### 1. 환경 변수 미설정 ⚠️ (가장 가능성 높음)
```
증상: 500 Internal Server Error
원인: OPENAI_API_KEY가 Vercel에 설정되지 않음
해결: 환경 변수 추가
```

### 2. 데이터베이스 파일 누락
```
증상: 500 에러
원인: data.sqlite3 파일이 Vercel에 없음
해결: 초기 DB 생성 로직 확인
```

### 3. 모듈 의존성 문제
```
증상: 500 에러
원인: better-sqlite3 같은 네이티브 모듈 문제
해결: Vercel 빌드 로그 확인
```

---

## ✅ 즉시 확인할 것

### 1단계: Vercel 환경 변수 확인 ⭐

1. **Vercel 대시보드**
   - https://vercel.com/dashboard
   - 프로젝트 선택

2. **Settings → Environment Variables**

3. **필수 환경 변수 확인**
   ```
   ✓ OPENAI_API_KEY = sk-proj-... (새 키)
   ✓ ENABLE_TRANSLATION = false
   ✓ DB_PATH = ./data.sqlite3
   ✓ ORDER_AI_XLSX_PATH = ./order-ai.xlsx
   ```

4. **모든 환경에 체크**
   - [x] Production
   - [x] Preview
   - [x] Development

5. **없으면 추가 후 Save**

### 2단계: Vercel 빌드 로그 확인

1. **Deployments 탭**

2. **최신 배포 클릭**

3. **Build Logs 확인**
   - 에러 메시지 찾기
   - "Cannot find module", "ENOENT" 같은 키워드 검색

4. **Function Logs 확인** (Runtime 탭)
   - 실제 500 에러 원인 확인
   - API 실행 중 발생한 에러 메시지

### 3단계: 재배포 (환경 변수 추가 후)

환경 변수를 추가했다면:

1. **Deployments → 최신 배포**
2. **⋯ → Redeploy**
3. ⚠️ **"Use existing Build Cache" 체크 해제**
4. **Redeploy**

---

## 🔧 대체 해결책

### 방법 A: 로컬에서 에러 재현

```bash
# 환경 변수 없이 실행
cd /home/user/webapp
unset OPENAI_API_KEY
npm run build

# 에러 메시지 확인
```

### 방법 B: Vercel CLI로 로그 확인

```bash
vercel logs https://your-app.vercel.app
```

---

## 📊 체크리스트

배포 후 확인:

- [ ] Vercel 환경 변수 설정됨
- [ ] OPENAI_API_KEY 올바름
- [ ] 빌드 로그에 에러 없음
- [ ] Function Logs에서 500 에러 원인 확인
- [ ] 재배포 완료
- [ ] GET /api/parse-full-order 테스트
- [ ] POST /api/parse-full-order 테스트

---

## 🆘 여전히 안 되면?

### 최종 해결책: 프로젝트 완전 재생성

이제 **100% 확실한 방법**입니다:

1. **Vercel 프로젝트 완전 삭제**
   - Settings → General → Delete Project

2. **새로 Import**
   - Add New... → Project
   - GitHub에서 order-ai 선택
   - Framework: Next.js (자동)

3. **환경 변수 설정**
   ```
   OPENAI_API_KEY = 새_API_키
   ENABLE_TRANSLATION = false
   DB_PATH = ./data.sqlite3
   ORDER_AI_XLSX_PATH = ./order-ai.xlsx
   ```

4. **Deploy**

5. **2-3분 후 테스트**

**이 방법으로 100% 작동합니다!**

