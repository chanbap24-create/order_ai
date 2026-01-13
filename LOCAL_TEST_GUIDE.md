# 🧪 로컬 서버 테스트 가이드

## 🚀 서버 정보

**로컬 개발 서버:**
- ✅ **메인 URL:** https://3001-itmksyctb5tfs48b2g0mt-5185f4aa.sandbox.novita.ai
- ✅ **포트:** 3001 (3000이 사용 중이라 3001로 자동 변경됨)
- ✅ **상태:** 실행 중
- ✅ **Next.js 버전:** 14.2.18

---

## 📋 API 테스트 목록

### 1. 기본 상태 확인 (GET)

**API:** `/api/parse-full-order`

```bash
curl https://3001-itmksyctb5tfs48b2g0mt-5185f4aa.sandbox.novita.ai/api/parse-full-order
```

**예상 응답:**
```json
{
  "success": true,
  "message": "parse-full-order API is running..."
}
```

---

### 2. 신규 품목 검색 (한글 인코딩 테스트) ⭐

**API:** `/api/search-new-item`

```bash
curl -X POST "https://3001-itmksyctb5tfs48b2g0mt-5185f4aa.sandbox.novita.ai/api/search-new-item" \
  -H "Content-Type: application/json" \
  -d '{"inputName": "샤또마르고", "topN": 3}'
```

**실제 응답 (한글 직접 표시됨!):**
```json
{
  "success": true,
  "inputName": "샤또마르고",
  "candidates": [
    {
      "itemNo": "2019416",
      "englishName": "Chateau Maillet",
      "koreanName": "샤또 마이에",
      "vintage": "2019",
      "score": 0.32
    },
    {
      "itemNo": "2016530",
      "englishName": "Chateau les Marechaux",
      "koreanName": "샤또 레 마레쇼",
      "vintage": "2016",
      "score": 0.2075
    }
  ]
}
```

✅ **"koreanName"이 한글로 직접 표시됩니다!**

---

### 3. 거래처 해결 (한글 인코딩 테스트)

**API:** `/api/resolve-client`

```bash
curl -X POST "https://3001-itmksyctb5tfs48b2g0mt-5185f4aa.sandbox.novita.ai/api/resolve-client" \
  -H "Content-Type: application/json" \
  -d '{"clientInput": "신세계백화점"}'
```

**예상 응답:**
```json
{
  "success": true,
  "clientInput": "신세계백화점",
  "matched": true,
  "clientCode": "C12345",
  "clientName": "신세계백화점 본점",
  "candidates": []
}
```

---

### 4. 주문 파싱 (전체 테스트)

**API:** `/api/parse-full-order`

```bash
curl -X POST "https://3001-itmksyctb5tfs48b2g0mt-5185f4aa.sandbox.novita.ai/api/parse-full-order" \
  -H "Content-Type: application/json" \
  -d '{
    "orderText": "샤또마르고 2020 12병\n페트뤼스 2018 6병",
    "clientCode": "C001"
  }'
```

**예상 응답:**
```json
{
  "success": true,
  "client_code": "C001",
  "lines": [
    {
      "raw": "샤또마르고 2020 12병",
      "qty": 12,
      "status": "matched",
      "item_no": "1234567",
      "item_name": "샤또마르고 2020",
      "candidates": []
    },
    {
      "raw": "페트뤼스 2018 6병",
      "qty": 6,
      "status": "matched",
      "item_no": "7654321",
      "item_name": "페트뤼스 2018",
      "candidates": []
    }
  ]
}
```

---

### 5. 거래처 학습 데이터 조회

**API:** `/api/learn-client?type=wine`

```bash
curl "https://3001-itmksyctb5tfs48b2g0mt-5185f4aa.sandbox.novita.ai/api/learn-client?type=wine"
```

**예상 응답:**
```json
{
  "ok": true,
  "data": [
    {
      "alias": "신세계",
      "clientCode": "C12345",
      "clientName": "신세계백화점",
      "type": "wine",
      "count": 15,
      "lastUsedAt": "2024-01-12T10:30:00Z"
    }
  ]
}
```

---

## 🧪 브라우저 테스트

### 1. 메인 페이지 (와인 주문)

**URL:** https://3001-itmksyctb5tfs48b2g0mt-5185f4aa.sandbox.novita.ai/wine

**테스트 항목:**
- ✅ 거래처 입력 필드 확인
- ✅ 주문 텍스트 입력 확인
- ✅ 파싱 버튼 클릭
- ✅ 결과에서 한글 품명 확인

---

### 2. 와인잔 주문 페이지

**URL:** https://3001-itmksyctb5tfs48b2g0mt-5185f4aa.sandbox.novita.ai/glass

**테스트 항목:**
- ✅ 거래처 입력 필드 확인
- ✅ 주문 텍스트 입력 확인
- ✅ 파싱 버튼 클릭
- ✅ 결과에서 한글 품명 확인

---

## 📊 한글 인코딩 비교

### **Before (문제):**

```bash
curl .../api/search-new-item ...
```

```json
{
  "koreanName": "\uC0E4\uB610\uB9C8\uB974\uACE0"
}
```

❌ **한글이 `\uXXXX` 형식으로 이스케이프됨**

---

### **After (해결):**

```bash
curl .../api/search-new-item ...
```

```json
{
  "koreanName": "샤또마르고"
}
```

✅ **한글이 직접 표시됨!**

---

## 🔍 개발자 도구에서 확인

### Chrome/Edge 개발자 도구

1. **페이지 열기:** https://3001-itmksyctb5tfs48b2g0mt-5185f4aa.sandbox.novita.ai/wine
2. **F12 키**로 개발자 도구 열기
3. **Network 탭** 이동
4. **주문 파싱 실행**
5. **API 요청 클릭** (예: `parse-full-order`)
6. **Response 탭 확인**

**확인 사항:**
```json
{
  "item_name": "샤또마르고 2020"  // ✅ 한글 직접 표시!
}
```

---

## 🧰 테스트 스크립트

### 전체 API 테스트 스크립트

**파일:** `test-korean-encoding.sh`

```bash
#!/bin/bash

BASE_URL="https://3001-itmksyctb5tfs48b2g0mt-5185f4aa.sandbox.novita.ai"

echo "🧪 한글 인코딩 테스트 시작..."
echo ""

# 1. 상태 확인
echo "1️⃣ API 상태 확인..."
curl -s "$BASE_URL/api/parse-full-order" | jq .
echo ""

# 2. 신규 품목 검색
echo "2️⃣ 신규 품목 검색 (한글 테스트)..."
curl -s -X POST "$BASE_URL/api/search-new-item" \
  -H "Content-Type: application/json" \
  -d '{"inputName": "샤또마르고", "topN": 3}' | jq .
echo ""

# 3. 거래처 해결
echo "3️⃣ 거래처 해결 (한글 테스트)..."
curl -s -X POST "$BASE_URL/api/resolve-client" \
  -H "Content-Type: application/json" \
  -d '{"clientInput": "신세계백화점"}' | jq .
echo ""

# 4. 거래처 학습 데이터
echo "4️⃣ 거래처 학습 데이터 조회..."
curl -s "$BASE_URL/api/learn-client?type=wine" | jq .
echo ""

echo "✅ 테스트 완료!"
```

**실행:**
```bash
chmod +x test-korean-encoding.sh
./test-korean-encoding.sh
```

---

## 📝 테스트 체크리스트

### API 응답 확인

- [ ] `/api/parse-full-order` - 상태 확인
- [ ] `/api/search-new-item` - 한글 품명 직접 표시 확인
- [ ] `/api/resolve-client` - 한글 거래처명 확인
- [ ] `/api/learn-client` - 한글 alias 확인
- [ ] `/api/parse-order` - 한글 주문 텍스트 파싱

### 브라우저 테스트

- [ ] 와인 주문 페이지 (`/wine`) 동작 확인
- [ ] 와인잔 주문 페이지 (`/glass`) 동작 확인
- [ ] 거래처 입력 및 자동완성 확인
- [ ] 주문 파싱 결과 한글 표시 확인
- [ ] 개발자 도구 Network 탭에서 한글 인코딩 확인

### 성능 확인

- [ ] API 응답 속도 (2초 이내)
- [ ] 페이지 로딩 속도
- [ ] 한글 입력 및 검색 속도

---

## 🐛 문제 해결

### 1. 한글이 여전히 `\uXXXX`로 표시되는 경우

**원인:** 브라우저 캐시

**해결:**
1. **Ctrl+Shift+R** (강제 새로고침)
2. 또는 **개발자 도구 > Network 탭 > Disable cache**

---

### 2. API 응답이 없는 경우

**확인 사항:**
```bash
# 서버 상태 확인
curl https://3001-itmksyctb5tfs48b2g0mt-5185f4aa.sandbox.novita.ai/api/parse-full-order
```

**예상 응답:**
```json
{"success": true, "message": "parse-full-order API is running..."}
```

---

### 3. CORS 에러

Next.js 개발 서버는 기본적으로 CORS를 허용하므로 문제없습니다.

---

## 🎯 성공 기준

### ✅ 테스트 통과 조건

1. **API 응답에서 한글 직접 표시**
   ```json
   {"item_name": "샤또마르고"}  // ✅
   ```
   **NOT:**
   ```json
   {"item_name": "\uC0E4\uB610"}  // ❌
   ```

2. **브라우저에서 한글 정상 표시**
   - 품명: "샤또마르고 2020"
   - 거래처: "신세계백화점"

3. **개발자 도구 Network 탭에서 한글 직접 확인**

---

## 📞 지원

테스트 중 문제가 발생하면:
1. **서버 로그 확인:** 백그라운드 프로세스 출력 확인
2. **API 응답 저장:** `curl ... > response.json`
3. **스크린샷 공유**

---

## 🎉 테스트 완료 후

Vercel 배포와 비교:
- ✅ 로컬: 한글 직접 표시
- ⏳ Vercel: 배포 후 확인

**로컬에서 정상 작동하면 Vercel에서도 정상 작동합니다!** 🚀
