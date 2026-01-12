# 🚀 Vercel 강제 재배포 가이드 (Next.js 14 배포)

## ⚠️ 현재 상황
- GitHub에 Next.js 14 코드 푸시 완료 ✅
- Vercel이 아직 새 코드로 배포하지 않음 ❌
- 이전 Next.js 15 빌드를 계속 사용 중

## 📋 해결 방법 (5분)

### 방법 1: Build Cache 완전 삭제 후 재배포 ⭐ (가장 확실)

1. **Vercel 대시보드 접속**
   - https://vercel.com/dashboard

2. **프로젝트 선택**
   - `order-ai` 클릭

3. **Deployments 탭**
   - 왼쪽 메뉴에서 "Deployments" 클릭

4. **최신 배포 선택**
   - 맨 위의 배포를 클릭

5. **재배포 (중요!)**
   - 오른쪽 위 ⋯ (점 3개) 클릭
   - **"Redeploy"** 클릭
   - ⚠️ **"Use existing Build Cache" 체크 해제** (매우 중요!)
   - **"Redeploy"** 버튼 클릭

6. **빌드 로그 확인**
   - Building... 표시되면 클릭
   - 로그에서 다음 확인:
     ```
     ▲ Next.js 14.2.18
     ✓ Creating an optimized production build
     ✓ Compiled successfully
     ```

7. **배포 완료 대기** (2-3분)
   - Status가 "Ready" 될 때까지 대기

8. **테스트**
   ```bash
   # 브라우저에서:
   https://your-app.vercel.app/api/parse-full-order
   
   # 예상 응답 (JSON):
   {"success": true, "message": "parse-full-order API is running..."}
   ```

---

### 방법 2: 환경 변수 변경으로 재배포 트리거

1. **Settings → Environment Variables**

2. **임시 변수 추가**
   - Key: `FORCE_REBUILD`
   - Value: `true`
   - Production, Preview, Development 체크

3. **Save**

4. **자동 배포 트리거됨**

5. **테스트 후 변수 삭제**

---

### 방법 3: Git에 빈 커밋 푸시 (자동)

이건 제가 해드릴 수 있습니다!

---

## 🔍 배포 확인 체크리스트

배포가 완료되면 다음을 확인하세요:

- [ ] 빌드 로그에 "Next.js 14.2.18" 표시
- [ ] 빌드 성공 메시지
- [ ] API 라우트 Dynamic(ƒ)으로 생성
- [ ] GET /api/parse-full-order → JSON 응답
- [ ] POST /api/parse-full-order → JSON 응답 (405 아님)
- [ ] 콘솔에 405 에러 없음

---

## 💡 왜 Build Cache를 비활성화해야 하나?

Vercel은 기본적으로 빌드 속도를 위해 캐시를 사용합니다:
- `.next` 폴더
- `node_modules`
- 빌드 아티팩트

문제는:
- 이전 Next.js 15 빌드가 캐시에 남아있음
- 새 Next.js 14 코드가 있어도 캐시를 우선 사용
- Build Cache를 비활성화해야 완전히 새로 빌드

---

## 🆘 여전히 안 되면?

### 최후의 수단: 프로젝트 완전 재생성

1. **기존 프로젝트 삭제**
   - Settings → General → Delete Project
   - 프로젝트 이름 입력 후 삭제

2. **새로 Import**
   - Add New... → Project
   - GitHub에서 `order-ai` 선택

3. **환경 변수만 설정**
   ```
   OPENAI_API_KEY = your_new_key
   ENABLE_TRANSLATION = false
   ```

4. **Deploy**

이렇게 하면 100% 작동합니다!

