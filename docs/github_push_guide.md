# 🔐 GitHub Push 가이드

## ❌ 현재 문제

**Bot 계정으로 Push 불가**
```
계정: genspark-ai-developer[bot]
권한: 읽기만 가능
결과: Push 실패 (Authentication failed)
```

**이유:**
- 사용자의 개인 저장소 (`chanbap24-create/order_ai`)
- Bot 계정은 write 권한 없음
- Personal Access Token 필요

---

## ✅ 해결 방법 3가지

### **방법 1: GitHub Personal Access Token 제공 (추천)**

#### **1단계: GitHub에서 Token 생성**
```
1. GitHub 로그인
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
3. "Generate new token" 클릭
4. Note: "Vercel Deploy" 
5. Expiration: 90 days
6. 권한 선택:
   ✅ repo (전체)
   ✅ workflow
7. "Generate token" 클릭
8. 토큰 복사 (한 번만 표시됨!)
```

#### **2단계: 토큰을 제공**
```
복사한 토큰을 저에게 알려주시면:
→ Git credential에 저장
→ 즉시 GitHub push
→ Vercel 자동 배포
```

#### **명령어 (제가 실행)**
```bash
cd /home/user/webapp
git remote set-url origin https://YOUR_TOKEN@github.com/chanbap24-create/order_ai.git
git push origin main
```

---

### **방법 2: SSH Key 사용**

#### **1단계: SSH Key 생성 (제가 실행)**
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub
```

#### **2단계: GitHub에 SSH Key 등록**
```
1. GitHub → Settings → SSH and GPG keys
2. "New SSH key" 클릭
3. 제가 제공한 public key 붙여넣기
4. "Add SSH key" 클릭
```

#### **3단계: Push (제가 실행)**
```bash
git remote set-url origin git@github.com:chanbap24-create/order_ai.git
git push origin main
```

---

### **방법 3: 프로젝트 백업 다운로드 후 직접 Push**

#### **1단계: 백업 생성 (제가 실행)**
```bash
cd /home/user
tar -czf webapp-backup.tar.gz webapp/
# AI Drive에 업로드
```

#### **2단계: 사용자가 직접 작업**
```bash
# 로컬에서
tar -xzf webapp-backup.tar.gz
cd webapp
git push origin main
```

**단점:** 시간 소요, 수동 작업 필요

---

## 🎯 추천 순서

### **1순위: Personal Access Token (5분)**
```
✅ 가장 빠름
✅ 안전함 (토큰 삭제 가능)
✅ 자동화 가능
```

### **2순위: SSH Key (10분)**
```
✅ 보안 우수
✅ 영구 사용 가능
⚠️ 설정 복잡
```

### **3순위: 수동 백업 (30분+)**
```
⚠️ 시간 소요
⚠️ 수동 작업
⚠️ 번거로움
```

---

## 📊 현재 Push 대기 중인 커밋

```
740c31c refactor: 학습 메시지 간결화
8e0449b feat: 약어 학습 61개 저장 및 방향 수정
b6f259b docs: PyTorch 학습 시스템 및 자동 학습 상세 설명 추가
b5fd855 feat: 멀티 토큰 검색 구현 - AND/Half/OR 전략 적용
50f01c0 멀티 토큰 검색 시스템 구현
a0a3dce feat: Stage 1 토큰 매핑 학습 시스템 구현
f3f2a86 Update README.md
e394cc7 fix: await import 오류 수정
c753b8a refactor: 품목 매칭 규칙 중앙 집중화
2eb613b fix: 줄바꿈된 품목 인식 개선

총 10개 커밋 대기 중
```

---

## 🚀 빠른 시작

### **Personal Access Token 제공 시**

```bash
# 제가 즉시 실행할 명령어
cd /home/user/webapp
git remote set-url origin https://YOUR_TOKEN@github.com/chanbap24-create/order_ai.git
git push origin main

# 예상 결과
Enumerating objects: 250, done.
Counting objects: 100% (250/250), done.
Delta compression using up to 4 threads
Compressing objects: 100% (180/180), done.
Writing objects: 100% (200/200), 150 KiB | 5 MiB/s, done.
Total 200 (delta 140), reused 0 (delta 0)
To https://github.com/chanbap24-create/order_ai.git
   2eb613b..740c31c  main -> main

✅ Push 완료!
✅ Vercel 자동 배포 시작
```

---

## 💡 보안 팁

### **Token 생성 시**
```
✅ 최소 권한만 부여 (repo만)
✅ 만료 기간 설정 (90일)
✅ 사용 후 즉시 삭제 가능
```

### **Token 사용 후**
```
1. GitHub → Settings → Developer settings
2. Personal access tokens
3. 해당 토큰 찾기
4. "Delete" 클릭
→ 즉시 무효화됨
```

---

## ❓ 어떤 방법을 선택하시겠습니까?

**A. Personal Access Token 제공** (추천, 5분) ✅  
**B. SSH Key 등록** (보안 우수, 10분)  
**C. 프로젝트 백업 다운로드** (수동, 30분+)

Token을 알려주시면 즉시 push하겠습니다! 🚀
