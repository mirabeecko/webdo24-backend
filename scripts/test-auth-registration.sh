#!/usr/bin/env bash
# ============================================================
# WebDo24 — test registračního toku (Supabase Auth) — CLOUD projekt
# Projekt: mljqltwcdqknezuqpisb (dle .env.local)
# Testovací režim: testovací email + úklid po testu.
# NEPUBLIKUJE nic, pouze ověřuje tok.
# ============================================================
set -u
cd "$(dirname "$0")/.."

# --- Načtení env bez tisku klíčů ---
set -a
. ./.env.local
set +a

API="${NEXT_PUBLIC_SUPABASE_URL}"
ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
SERVICE="${SUPABASE_SERVICE_ROLE_KEY}"

PASS="TestHeslo123!"
TS=$(date +%s)
EMAIL="auth-test-${TS}@webdo24-test.cz"
NAME="Test Registrace ${TS}"

PASS_COUNT=0
FAIL_COUNT=0
declare -a FAILURES=()

pass() { PASS_COUNT=$((PASS_COUNT+1)); echo "  [PASS] $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT+1)); FAILURES+=("$1"); echo "  [FAIL] $1"; }

echo "============================================================"
echo "TEST REGISTRAČNÍHO TOKU — Supabase Auth (cloud)"
echo "Projekt: ${API}"
echo "Test email: ${EMAIL}"
echo "============================================================"

# ---------- 1. Dostupnost API + auth settings ----------
echo ""
echo "[1] Dostupnost Supabase Auth API"
HTTP=$(curl -s -o /tmp/wd24_settings.json -w "%{http_code}" \
  "${API}/auth/v1/settings" -H "apikey: ${ANON}")
if [ "$HTTP" = "200" ]; then
  pass "GET /auth/v1/settings -> HTTP ${HTTP}"
  EXTERNAL=$(jq -r '.external // {}' /tmp/wd24_settings.json 2>/dev/null)
  echo "      external providers: ${EXTERNAL}"
else
  fail "GET /auth/v1/settings -> HTTP ${HTTP}"
  cat /tmp/wd24_settings.json | head -5
fi

# ---------- 2. Signup (jako registerAction) ----------
echo ""
echo "[2] signUp (anon klíč, role=customer)"
HTTP=$(curl -s -o /tmp/wd24_signup.json -w "%{http_code}" \
  -X POST "${API}/auth/v1/signup" \
  -H "apikey: ${ANON}" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"data\":{\"role\":\"customer\",\"name\":\"${NAME}\"}}")
echo "      HTTP ${HTTP}"
if [ "$HTTP" = "200" ]; then
  pass "signUp -> HTTP 200"
else
  fail "signUp -> HTTP ${HTTP}"
  cat /tmp/wd24_signup.json | head -5
fi

USER_ID=$(jq -r '.user.id // empty' /tmp/wd24_signup.json 2>/dev/null)
HAS_SESSION=$(jq -r '(.session != null)' /tmp/wd24_signup.json 2>/dev/null)
IDENTITIES=$(jq -r '.user.identities | length' /tmp/wd24_signup.json 2>/dev/null)
EMAIL_CONF=$(jq -r '.user.email_confirmed_at // "null"' /tmp/wd24_signup.json 2>/dev/null)

echo "      user.id: ${USER_ID}"
echo "      session přítomna: ${HAS_SESSION}"
echo "      identities: ${IDENTITIES}  (0 = čeká na potvrzení emailu)"
echo "      email_confirmed_at: ${EMAIL_CONF}"

if [ -z "$USER_ID" ]; then
  fail "signUp nevrátil user.id — nelze pokračovat"
  echo ""
  echo "===== REPORT ====="
  echo "PASS: ${PASS_COUNT}  FAIL: ${FAIL_COUNT}"
  for f in "${FAILURES[@]}"; do echo " - $f"; done
  exit 1
fi
if [ "$IDENTITIES" = "0" ]; then
  fail "Email confirmation JE ZAPNUTÝ — signUp vrací user bez session (identities=0)"
else
  pass "Email confirmation vypnutý (identities=${IDENTITIES})"
fi

# Session token z odpovědi (pokud je) — pro anon insert test
ACCESS_TOKEN=$(jq -r '.session.access_token // empty' /tmp/wd24_signup.json 2>/dev/null)

# ---------- 3. Insert do webdo24_customers přes ANON klienta ----------
echo ""
echo "[3] insert webdo24_customers přes ANON klienta (jako registerAction)"
if [ -n "$ACCESS_TOKEN" ]; then
  HTTP=$(curl -s -o /tmp/wd24_insert.json -w "%{http_code}" \
    -X POST "${API}/rest/v1/webdo24_customers" \
    -H "apikey: ${ANON}" -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"${USER_ID}\",\"name\":\"${NAME}\",\"email\":\"${EMAIL}\"}")
else
  HTTP=$(curl -s -o /tmp/wd24_insert.json -w "%{http_code}" \
    -X POST "${API}/rest/v1/webdo24_customers" \
    -H "apikey: ${ANON}" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"${USER_ID}\",\"name\":\"${NAME}\",\"email\":\"${EMAIL}\"}")
fi
echo "      HTTP ${HTTP}"
INSERT_ERR=$(jq -r '.message // .error // empty' /tmp/wd24_insert.json 2>/dev/null | head -c 300)
if [ "$HTTP" = "201" ]; then
  pass "Insert přes anon OK (HTTP 201)"
else
  fail "Insert přes anon SELHAL (HTTP ${HTTP}): ${INSERT_ERR}"
  echo "      -> registerAction tuto chybu TICHE ignoruje (žádný log, vrací success:true)"
fi

# ---------- 4. Kontrolní insert přes SERVICE ROLE ----------
echo ""
echo "[4] kontrolní insert webdo24_customers přes service role"
HTTP=$(curl -s -o /tmp/wd24_insert_sr.json -w "%{http_code}" \
  -X POST "${API}/rest/v1/webdo24_customers" \
  -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"${USER_ID}\",\"name\":\"${NAME}\",\"email\":\"${EMAIL}\"}")
echo "      HTTP ${HTTP}"
CUST_ID=$(jq -r '.[0].id // empty' /tmp/wd24_insert_sr.json 2>/dev/null)
if [ "$HTTP" = "201" ]; then
  pass "Insert přes service role OK (HTTP 201, id=${CUST_ID})"
else
  fail "Insert přes service role SELHAL (HTTP ${HTTP})"
fi

# ---------- 5. Login (signInWithPassword) ----------
echo ""
echo "[5] login (signInWithPassword)"
HTTP=$(curl -s -o /tmp/wd24_login.json -w "%{http_code}" \
  -X POST "${API}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON}" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}")
LOGIN_ERR=$(jq -r '.error_description // .msg // .error // empty' /tmp/wd24_login.json 2>/dev/null | head -c 200)
if [ "$HTTP" = "200" ]; then
  pass "login OK (HTTP 200)"
  LOGIN_USER_ID=$(jq -r '.user.id // empty' /tmp/wd24_login.json 2>/dev/null)
else
  fail "login SELHAL (HTTP ${HTTP}): ${LOGIN_ERR}"
fi

# ---------- 6. GET customer profil přes novou session (simulace dashboardu) ----------
echo ""
echo "[6] čtení vlastního profilu (SELECT webdo24_customers s anon session)"
LOGIN_AT=$(jq -r '.access_token // empty' /tmp/wd24_login.json 2>/dev/null)
if [ -n "$LOGIN_AT" ]; then
  HTTP=$(curl -s -o /tmp/wd24_select.json -w "%{http_code}" \
    "${API}/rest/v1/webdo24_customers?select=id,name,email&user_id=eq.${USER_ID}" \
    -H "apikey: ${ANON}" -H "Authorization: Bearer ${LOGIN_AT}")
  ROWS=$(jq -r 'length' /tmp/wd24_select.json 2>/dev/null)
  echo "      HTTP ${HTTP}, řádků: ${ROWS}"
  if [ "$HTTP" = "200" ] && [ "$ROWS" -ge 1 ]; then
    pass "Čtení vlastního profilu OK (${ROWS} řádek)"
  else
    fail "Čtení vlastního profilu SELHALO (HTTP ${HTTP}, řádků ${ROWS})"
  fi
else
  fail "Nelze testovat SELECT — login nevrátil session"
fi

# ---------- 7. Ověření stavu v auth (admin API) ----------
echo ""
echo "[7] ověření uživatele v auth.users (admin API)"
HTTP=$(curl -s -o /tmp/wd24_user.json -w "%{http_code}" \
  "${API}/auth/v1/admin/users/${USER_ID}" \
  -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}")
if [ "$HTTP" = "200" ]; then
  ROLE_META=$(jq -r '.user_metadata.role // "?"' /tmp/wd24_user.json 2>/dev/null)
  EMAIL_VAL=$(jq -r '.email // "?"' /tmp/wd24_user.json 2>/dev/null)
  pass "Uživatel existuje (role=${ROLE_META}, email=${EMAIL_VAL})"
else
  fail "Uživatel v admin API nenalezen (HTTP ${HTTP})"
fi

# ---------- 8. ÚKLID ----------
echo ""
echo "[8] úklid testovacích dat"
if [ -n "$CUST_ID" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE "${API}/rest/v1/webdo24_customers?id=eq.${CUST_ID}" \
    -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}")
  echo "      DELETE customer ${CUST_ID}: HTTP ${HTTP}"
fi
if [ -n "$USER_ID" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE "${API}/auth/v1/admin/users/${USER_ID}" \
    -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}")
  echo "      DELETE auth user ${USER_ID}: HTTP ${HTTP}"
fi
# poslední pojistka: smazat případné zbylé řádky dle emailu
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X DELETE "${API}/rest/v1/webdo24_customers?email=eq.${EMAIL}" \
  -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}")
echo "      DELETE zbytky dle emailu: HTTP ${HTTP}"

# ---------- REPORT ----------
echo ""
echo "============================================================"
echo "VÝSLEDEK: PASS=${PASS_COUNT}  FAIL=${FAIL_COUNT}"
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "Chyby:"
  for f in "${FAILURES[@]}"; do echo "  ✗ ${f}"; done
else
  echo "Bez chyb."
fi
echo "============================================================"
