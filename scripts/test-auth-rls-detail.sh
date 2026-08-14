#!/usr/bin/env bash
# WebDo24 — detailní test RLS + NOT NULL na webdo24_customers
set -u
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
API="${NEXT_PUBLIC_SUPABASE_URL}"; ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"; SERVICE="${SUPABASE_SERVICE_ROLE_KEY}"
TS=$(date +%s); EMAIL="rls-test-${TS}@webdo24-test.cz"; PASS="TestHeslo123!"
NAME="RLS Test ${TS}"
PASS_COUNT=0; FAIL_COUNT=0; declare -a FAILURES=()
pass() { PASS_COUNT=$((PASS_COUNT+1)); echo "  [PASS] $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT+1)); FAILURES+=("$1"); echo "  [FAIL] $1"; }

echo "=== TEST RLS + NOT NULL: webdo24_customers ==="

# 0) Vytvoř uživatele
HTTP=$(curl -s -o /tmp/wd24_rls_signup.json -w "%{http_code}" -X POST "${API}/auth/v1/signup" \
  -H "apikey: ${ANON}" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"data\":{\"role\":\"customer\",\"name\":\"${NAME}\"}}")
USER_ID=$(jq -r '.user.id // empty' /tmp/wd24_rls_signup.json 2>/dev/null)
echo "signup HTTP ${HTTP}, user=${USER_ID}"

# Login pro session (authenticated role)
HTTP=$(curl -s -o /tmp/wd24_rls_login.json -w "%{http_code}" -X POST "${API}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON}" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}")
AT=$(jq -r '.access_token // empty' /tmp/wd24_rls_login.json 2>/dev/null)
echo "login HTTP ${HTTP}, session: $([ -n "$AT" ] && echo ANO || echo NE)"

# 1) Iterativní zjištění povinných polí přes service role
echo ""
echo "[1] Iterativní insert přes SERVICE ROLE (zjištění minimální sady polí)"
BODY="{\"user_id\":\"${USER_ID}\",\"name\":\"${NAME}\",\"email\":\"${EMAIL}\"}"
for field in "phone" "company" "stripe_customer_id" "stripe_subscription_id" "subscription_status" "current_period_end" "paid_months" "ico" "dic" "address" "note" "telegram_phone" "telegram_connected" "telegram_chat_id"; do
  case "$field" in
    paid_months) VAL=0;; telegram_connected) VAL=false;; *) VAL="";;
  esac
  if [ "$field" = "current_period_end" ]; then VAL="null"; fi
  BODY=$(echo "$BODY" | jq --arg f "$field" --arg v "$VAL" 'if $v == "" then .[$f] = "" else .[$f] = ($v | if . == "null" then null else . end) end' 2>/dev/null)
  HTTP=$(curl -s -o /tmp/wd24_rls_ins.json -w "%{http_code}" -X POST "${API}/rest/v1/webdo24_customers" \
    -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}" -H "Content-Type: application/json" \
    -d "$BODY" 2>/dev/null)
  if [ "$HTTP" = "201" ]; then
    echo "      OK s polem '${field}' (HTTP 201)"
    break
  else
    MSG=$(jq -r '.message // .error // empty' /tmp/wd24_rls_ins.json 2>/dev/null | head -c 150)
    echo "      přidán '${field}' -> HTTP ${HTTP}: ${MSG}"
  fi
done
CUST_ID=$(jq -r '.[0].id // empty' /tmp/wd24_rls_ins.json 2>/dev/null)
if [ -n "$CUST_ID" ]; then pass "Minimální sada polí nalezena (customer id=${CUST_ID})"; else fail "Insert přes service role stále selhává"; fi

# 2) INSERT přes ANON bez session (přesně jako registerAction při signup bez session)
echo ""
echo "[2] INSERT přes ANON bez session (registerAction scénář)"
HTTP=$(curl -s -o /tmp/wd24_rls_anon.json -w "%{http_code}" -X POST "${API}/rest/v1/webdo24_customers" \
  -H "apikey: ${ANON}" -H "Content-Type: application/json" \
  -d "{\"user_id\":\"${USER_ID}\",\"name\":\"${NAME}\",\"email\":\"${EMAIL}\",\"phone\":\"\"}")
MSG=$(jq -r '.message // .error // .code // empty' /tmp/wd24_rls_anon.json 2>/dev/null | head -c 200)
echo "      HTTP ${HTTP}: ${MSG}"
if [ "$HTTP" = "201" ]; then
  fail "ANON bez session MŮŽE vkládat (bezpečnostní díra!)"
elif echo "$MSG" | grep -qi "row-level security"; then
  pass "RLS blokuje anon insert (${MSG})"
else
  fail "Anon insert selhal jinak (HTTP ${HTTP}): ${MSG}"
fi

# 3) INSERT přes ANON se session (authenticated)
echo ""
echo "[3] INSERT přes ANON se session (authenticated role)"
HTTP=$(curl -s -o /tmp/wd24_rls_auth.json -w "%{http_code}" -X POST "${API}/rest/v1/webdo24_customers" \
  -H "apikey: ${ANON}" -H "Authorization: Bearer ${AT}" -H "Content-Type: application/json" \
  -d "{\"user_id\":\"${USER_ID}\",\"name\":\"${NAME}\",\"email\":\"${EMAIL}\",\"phone\":\"\"}")
MSG=$(jq -r '.message // .error // .code // empty' /tmp/wd24_rls_auth.json 2>/dev/null | head -c 200)
echo "      HTTP ${HTTP}: ${MSG}"
if [ "$HTTP" = "201" ]; then
  fail "Authenticated uživatel MŮŽE vkládat cizí user_id (bezpečnostní díra!)"
elif echo "$MSG" | grep -qi "row-level security"; then
  pass "RLS blokuje authenticated insert (${MSG})"
else
  fail "Auth insert selhal jinak (HTTP ${HTTP}): ${MSG}"
fi

# 4) SELECT cizího profilu přes authenticated session (izolace)
echo ""
echo "[4] SELECT cizího záznamu (user_id=eq.99999999-...) přes authenticated session"
HTTP=$(curl -s -o /tmp/wd24_rls_sel.json -w "%{http_code}" \
  "${API}/rest/v1/webdo24_customers?select=id&user_id=eq.00000000-0000-0000-0000-000000000000" \
  -H "apikey: ${ANON}" -H "Authorization: Bearer ${AT}")
ROWS=$(jq -r 'length' /tmp/wd24_rls_sel.json 2>/dev/null)
echo "      HTTP ${HTTP}, řádků: ${ROWS}"
if [ "$HTTP" = "200" ] && [ "$ROWS" = "0" ]; then
  pass "Izolace SELECT funguje (0 cizích řádků)"
else
  fail "SELECT izolace problém (HTTP ${HTTP}, ${ROWS} řádků)"
fi

# 5) ÚKLID
echo ""
echo "[5] úklid"
if [ -n "$CUST_ID" ]; then
  curl -s -o /dev/null -w "DELETE customer: HTTP %{http_code}\n" -X DELETE "${API}/rest/v1/webdo24_customers?id=eq.${CUST_ID}" \
    -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}"
fi
curl -s -o /dev/null -w "DELETE auth user: HTTP %{http_code}\n" -X DELETE "${API}/auth/v1/admin/users/${USER_ID}" \
  -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}"
curl -s -o /dev/null -w "DELETE zbytky: HTTP %{http_code}\n" -X DELETE "${API}/rest/v1/webdo24_customers?email=eq.${EMAIL}" \
  -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}"

echo ""
echo "=== VÝSLEDEK: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT} ==="
for f in "${FAILURES[@]}"; do echo "  ✗ ${f}"; done
