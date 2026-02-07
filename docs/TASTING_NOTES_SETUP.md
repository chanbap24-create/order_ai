# 🍷 테이스팅 노트 설정 가이드

## 📋 목차
1. [파일 준비](#1-파일-준비)
2. [인덱스 생성](#2-인덱스-생성)
3. [GitHub Release 업로드](#3-github-release-업로드)
4. [앱 설정 업데이트](#4-앱-설정-업데이트)
5. [테스트](#5-테스트)

---

## 1. 파일 준비

### PDF 파일명 규칙:
```
품목번호.pdf

예시:
✅ 3422501.pdf
✅ 3422004.pdf
✅ 3419404.pdf

❌ AC 아큐먼.pdf (품목번호가 아님)
❌ 3422501 (확장자 없음)
```

### 폴더 구조:
```
tasting-notes/
├── 3422501.pdf
├── 3422004.pdf
├── 3419404.pdf
├── ...
└── (500개 PDF 파일)
```

---

## 2. 인덱스 생성

### 자동 생성 (추천):

```bash
# 1. 스크립트가 있는 위치로 이동
cd /path/to/order_ai

# 2. PDF 폴더를 스캔하여 index.json 생성
node scripts/generate-tasting-notes-index.js /path/to/tasting-notes/

# 3. tasting-notes-index.json 파일 생성됨!
```

### 수동 생성:

`tasting-notes-index.json` 파일 생성:

```json
{
  "version": "1.0",
  "updated_at": "2026-02-05",
  "base_url": "https://github.com/chanbap24-create/order_ai/releases/download/v1.0",
  "notes": {
    "3422501": {
      "exists": true,
      "filename": "3422501.pdf",
      "size_kb": 2048,
      "pages": 3,
      "wine_name": "AC 아큐먼 마운틴사이드 소비뇽 블랑"
    }
  }
}
```

---

## 3. GitHub Release 업로드

### Step 1: Release 생성

1. https://github.com/chanbap24-create/order_ai/releases 접속
2. **"Create a new release"** 클릭
3. 다음 정보 입력:
   - **Tag**: `v1.0`
   - **Release title**: `Tasting Notes v1.0`
   - **Description**: 
     ```
     와인 테이스팅 노트 데이터베이스
     - 총 500개 와인
     - 업데이트 날짜: 2026-02-05
     ```

### Step 2: 파일 업로드

1. **tasting-notes-index.json** 파일 업로드
2. **모든 PDF 파일 업로드** (500개)
   
   ⚠️ **주의**: 
   - GitHub는 한 번에 여러 파일 업로드 가능
   - 파일 이름이 정확히 `품목번호.pdf` 형식인지 확인!

### Step 3: Release 발행

**"Publish release"** 클릭

---

## 4. 앱 설정 업데이트

### `/app/api/tasting-notes/route.ts` 파일 수정:

```typescript
// 현재 (예시):
const GITHUB_RELEASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/v1.0';

// Release 버전에 맞게 수정:
const GITHUB_RELEASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/v1.0';
```

### 변경 후 커밋:

```bash
git add app/api/tasting-notes/route.ts
git commit -m "config: Update tasting notes release URL"
git push origin main
```

---

## 5. 테스트

### 배포 완료 후 (2-3분):

1. **재고 확인 페이지 접속**
   ```
   https://order-ai-one.vercel.app/inventory
   ```

2. **와인 검색**
   ```
   예: "아큐먼" 검색
   ```

3. **테이스팅 노트 버튼 클릭**
   ```
   품목번호 옆 [📄 노트] 버튼 클릭
   ```

4. **PDF 확인**
   ```
   - 모달에서 PDF 미리보기
   - 다운로드 또는 새 탭에서 열기
   ```

---

## 🔄 업데이트 방법

### 테이스팅 노트 추가/수정 시:

1. **새 Release 생성** (예: v1.1)
2. **업데이트된 파일들 업로드**
3. **앱 설정에서 URL 변경**
   ```typescript
   const GITHUB_RELEASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/v1.1';
   ```
4. **커밋 & 푸시**

---

## ❓ 문제 해결

### 테이스팅 노트가 안 보여요!

1. **브라우저 콘솔 확인**
   - F12 → Console 탭
   - 에러 메시지 확인

2. **Release URL 확인**
   - GitHub Release 페이지에서 파일 URL 복사
   - 브라우저에서 직접 접속해보기

3. **index.json 확인**
   - https://github.com/chanbap24-create/order_ai/releases/download/v1.0/tasting-notes-index.json
   - 품목번호가 정확한지 확인

4. **PDF 파일명 확인**
   - `3422501.pdf` (O)
   - `3422501 .pdf` (X - 공백 있음)
   - `3422501.PDF` (X - 대문자)

---

## 📊 성능 정보

- **첫 로드**: ~2초 (index.json 다운로드)
- **이후 조회**: ~0.1초 (메모리 캐시)
- **PDF 로딩**: ~1-3초 (파일 크기에 따라)
- **캐시 유지**: 1시간

---

## 💡 팁

### 파일 크기 최적화:
```bash
# PDF 압축 (선택사항)
# 큰 PDF 파일은 압축하면 빠른 로딩 가능
```

### 일괄 업로드:
```bash
# 500개 파일을 한 번에 선택해서 업로드 가능
# Shift + 클릭으로 범위 선택
```

### 버전 관리:
```
v1.0 - 초기 500개
v1.1 - 50개 추가
v1.2 - 100개 업데이트
```

---

## 📞 지원

문제가 있으면 다음을 확인하세요:
- GitHub Release 페이지: https://github.com/chanbap24-create/order_ai/releases
- API 로그: Vercel Dashboard → Logs
- 브라우저 Console: F12 → Console
