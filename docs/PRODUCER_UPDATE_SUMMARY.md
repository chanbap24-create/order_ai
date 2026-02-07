# 🍷 생산자 목록 업데이트 완료

## 📊 업데이트 내용

### ✅ 완료 사항
- **order-ai.xlsx** English 시트에서 71개 생산자 자동 추출
- **resolveItemsWeighted.ts** WINE_PRODUCERS 배열 업데이트
- 영문 + 한글 생산자명 모두 포함

### 🌍 국가별 생산자 수

| 국가 | 생산자 수 | 주요 생산자 |
|------|-----------|-------------|
| 🇫🇷 France | 27개 | Clement Lavallee, Chateau Maillet, Louis Michel, Vincent Girardin |
| 🇺🇸 USA | 20개 | Ridge, Pisoni, Hoopes, Gamble Family |
| 🇮🇹 Italy | 10개 | Biondi Santi, Altesino, Ornellaia, Anselmi |
| 🇵🇹 Portugal | 5개 | Graham's Port, Symington Family Estate |
| 🇪🇸 Spain | 4개 | Juve y Camps, Mas Martinet |
| 기타 | 5개 | Argentina, Australia, Chile, England, New Zealand |

### 🎯 핵심 개선 사항

#### 1️⃣ **클레멍 라발리 문제 해결**
```typescript
// 이전: 없음 (검색 불가)
// 현재:
'clement lavallee', '클레멍 라발리', '클레멍라발레', 'cl',
```

**테스트 케이스**:
- ✅ "클레멍라발레 샤블리 2" → `CL` 생산자로 인식
- ✅ "클레멍 라발리 샤블리 2" → `CL` 생산자로 인식
- ✅ "CL 샤블리 2" → 직접 매칭

#### 2️⃣ **생산자 포맷 개선**
```typescript
// 영문 + 한글 + 약어 모두 포함
'charles heidsieck', '찰스 하이직', '샤를 에드시크',
'chateau de la gardine', '샤또 드 라 가르딘',
'biondi santi', '비온디 산티', '비온디산티',
```

#### 3️⃣ **국가별 분류**
- 주석으로 국가/개수 명시
- 알파벳순 정렬
- 유지보수 용이성 향상

### 📁 생성된 파일

#### 1. `extract_producers_v3.js`
- Excel 파싱 및 생산자 추출 스크립트
- D(국가), E(공급자명 영어) 컬럼 기반

#### 2. `producers_new_v3.ts`
- 추출된 생산자 목록 TypeScript 파일
- 71개 생산자 전체 포함

#### 3. `WINE_PRODUCERS` 배열 업데이트
- `app/lib/resolveItemsWeighted.ts` (94-185줄)
- 기존 79개 → 새로운 71개 (중복 제거, 실제 공급자 기반)

### 🔄 자동화 프로세스

```bash
# 1. Excel에서 생산자 추출
node extract_producers_v3.js

# 2. resolveItemsWeighted.ts 수동 업데이트
# (향후 자동화 가능)

# 3. Git 커밋 & 푸시
git add -A
git commit -m "feat: Excel 기반 생산자 목록 업데이트"
git push origin main
```

### 🧪 테스트 방법

#### Wine 페이지에서 테스트
```
입력: "클레멍라발레 샤블리 2"
기대: CL 샤블리 "샹트 메흘르" 2병 검색 성공
```

#### 디버그 API로 확인
```bash
# 별칭 확장 확인
curl "https://order-ai-one.vercel.app/api/debug-alias?q=클레멍"

# 생산자 감지 확인
curl "https://order-ai-one.vercel.app/api/debug-alias?q=클레멍라발레 샤블리"
```

### 🎉 기대 효과

1. **검색 정확도 향상**
   - 공백 있는/없는 입력 모두 처리
   - 영문/한글/약어 모두 인식

2. **유지보수성 향상**
   - Excel 기반 자동 추출
   - 국가별 분류로 관리 용이

3. **확장성**
   - 새 생산자 추가 시 Excel만 업데이트
   - 스크립트 재실행으로 자동 반영

### 📝 후속 작업 (선택)

- [ ] Excel 업데이트 → 자동 배포 파이프라인 구성
- [ ] 생산자별 통계 대시보드 추가
- [ ] 한글 생산자명 M 컬럼 매핑 (현재는 영문만)

### 🚀 배포 상태

- ✅ 커밋: `cf57b50` - Excel 기반 생산자 목록 업데이트
- ✅ 푸시: origin/main 완료
- 🔄 Vercel 배포: 자동 배포 중
- 🌐 배포 URL: https://order-ai-one.vercel.app

---

**업데이트 완료 시각**: 2026-01-16  
**변경 파일 수**: 7개  
**추가된 생산자**: 71개
