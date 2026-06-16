#!/usr/bin/env bash
# .env.local에서 Mumbai(기존) + Seoul(신규) 정보 로드
# Migration 스크립트들이 source하는 공통 파일
# bash/zsh 공용

# 스크립트 위치 기준 절대 경로 (bash/zsh 공용)
_SELF="${BASH_SOURCE[0]:-$0}"
_DIR="$(cd "$(dirname "$_SELF")" && pwd)"
ENV_FILE="$_DIR/../../.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env.local not found at $ENV_FILE"
  exit 1
fi

# .env 파싱 + Mumbai URL의 pooler 호스트 교정 (ap-northeast-2 → ap-south-1)
# 출력을 eval해서 env var 설정
eval "$(python3 <<PY
import urllib.parse
with open("$ENV_FILE") as f:
    env = {}
    for line in f:
        line = line.rstrip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

mumbai_db = env.get('SUPABASE_DB_URL', '')
# 잘못된 ap-northeast-2 pooler → 실제 Mumbai DB가 있는 ap-south-1로 교정
if 'ap-northeast-2' in mumbai_db and 'nunuyropsfoaafkustli' in mumbai_db:
    mumbai_db = mumbai_db.replace('aws-0-ap-northeast-2', 'aws-1-ap-south-1')
    mumbai_db = mumbai_db.replace('aws-1-ap-northeast-2', 'aws-1-ap-south-1')
    # 포트 6543(transaction) → 5432(session) for pg_dump compatibility
    mumbai_db = mumbai_db.replace(':6543/', ':5432/')

def q(s):
    return "'" + s.replace("'", "'\\\\''") + "'"

print(f'export MUMBAI_DB_URL={q(mumbai_db)}')
print(f'export MUMBAI_URL={q(env.get("SUPABASE_URL", ""))}')
print(f'export MUMBAI_SERVICE_ROLE_KEY={q(env.get("SUPABASE_SERVICE_ROLE_KEY", ""))}')
print(f'export SEOUL_DB_URL={q(env.get("SUPABASE_SEOUL_DB_URL", ""))}')
print(f'export SEOUL_URL={q(env.get("SUPABASE_SEOUL_URL", ""))}')
print(f'export SEOUL_ANON_KEY={q(env.get("SUPABASE_SEOUL_ANON_KEY", ""))}')
PY
)"

# 검증
_check() {
  if [ -z "$2" ]; then
    echo "ERROR: $1 not set in .env.local"
    return 1
  fi
}
_check MUMBAI_DB_URL "$MUMBAI_DB_URL" || exit 1
_check MUMBAI_URL "$MUMBAI_URL" || exit 1
_check SEOUL_DB_URL "$SEOUL_DB_URL" || exit 1
_check SEOUL_URL "$SEOUL_URL" || exit 1

if ! command -v pg_dump &> /dev/null; then
  echo "ERROR: pg_dump not installed. Run:"
  echo "  brew install libpq && brew link --force libpq"
  exit 1
fi

echo "✓ Environment loaded"
echo "  Mumbai: ${MUMBAI_URL} (pooler: ap-south-1 session mode)"
echo "  Seoul:  ${SEOUL_URL}"
echo "  pg_dump: $(pg_dump --version)"
