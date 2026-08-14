#!/usr/bin/env bash
# WebDo24 — čistý test RLS na webdo24_customers (INSERT+SELECT izolace)
set -u
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
API="${NEXT_PUBLIC_SUPABASE_URL}"; ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"; SERVICE="${SUPABASE_SERVICE_ROLE_KEY}"
TS=$(date +%s); PASS="TestHeslo123!"
PASS_COUNT=0; FAIL_COUNT=0; declare -a FAILURES=()
pass() { PASS_COUNT=$((PASS_COUNT+1)); echo "  [PASS] $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT+1)); FAILURES+=("$1"); echo "  [FAIL] $1"; }

echo "=== RLS čistý test: webdo24_customers ==="

# Uživatel A (vlastník záznamu)
EMA="rls-a-${TS}@webdo24-test.cz"
curl -s -o /dev/null -X POST "${API}/auth/v1/signup" -H "apikey: ${ANON}" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMA}\",\"password\":\"${PASS}\",\"data\":{\"role\":\"customer\",\"name\":\"User A\"}}"
curl -s -o /tmp/wd24_a_login.json -X POST "${API}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON}" -H "Content-Type: application/json" -d "{\"email\":\"${EMA}\",\"password\":\"${PASS}\"}"
UA=$(jq -r '.user.id // empty' /tmp/wd24_a_login.json 2>/dev/null)
ATA=$(jq -r '.access_token // empty' /tmp/wd24_a_login.json 2>/dev/null)

# Uživatel B (cizí)
EMB="rls-b-${TS}@webdo24-test.cz"
curl -s -o /dev/null -X POST "${API}/auth/v1/signup" -H "apikey: ${ANON}" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMB}\",\"password\":\"${PASS}\",\"data\":{\"role\":\"customer\",\"name\":\"User B\"}}"
curl -s -o /tmp/wd24_b_login.json -X POST "${API}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON}" -H "Content-Type: application/json" -d "{\"email\":\"${EMB}\",\"password\":\"${PASS}\"}"
UB=$(jq -r '.user.id // empty' /tmp/wd24_b_login.json 2>/dev/null)
ATB=$(jq -r '.access_token // empty' /tmp/wd24_b_login.json 2>/dev/null)
echo "User A: ${UA} | User B: ${UB}"

# Service role vytvoří záznam pro A
curl -s -o /tmp/wd24_sr_ins.json -X POST "${API}/rest/v1/webdo24_customers" \
  -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}" -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"user_id\":\"${UA}\",\"name\":\"User A\",\"email\":\"${EMA}\",\"phone\":\"+420111222333\"}"
CA=$(jq -r '.[0].id // empty' /tmp/wd24_sr_ins.json 2>/dev/null)
echo "Customer záznam A: ${CA}"

# [1] ANON bez session: INSERT unikátní email
echo ""
echo "[1] ANON bez session INSERT (unikátní email)"
HTTP=$(curl -s -o /tmp/wd24_t1.json -w "%{http_code}" -X POST "${API}/rest/v1/webdo24_customers" \
  -H "apikey: ${ANON}" -H "Content-Type: application/json" \
  -d "{\"user_id\":\"${UA}\",\"name\":\"Anon Vkladatel\",\"email\":\"rls-anon-${TS}@webdo24-test.cz\",\"phone\":\"+420000000\"}")
MSG=$(jq -r '.message // .error // .code // empty' /tmp/wd24_t1.json 2>/dev/null | head -c 150)
echo "      HTTP ${HTTP}: ${MSG}"
if [ "$HTTP" = "201" ]; then fail "ANON bez session MŮŽE vkládat do webdo24_customers (BEZPEČNOSTNÍ DÍRA)"; else pass "Anon insert blokován (HTTP ${HTTP}: ${MSG})"; fi

# [2] Authenticated B: INSERT s cizím user_id (A)
echo ""
echo "[2] Authenticated B INSERT s cizím user_id"
HTTP=$(curl -s -o /tmp/wd24_t2.json -w "%{http_code}" -X POST "${API}/rest/v1/webdo24_customers" \
  -H "apikey: ${ANON}" -H "Authorization: Bearer ${ATB}" -H "Content-Type: application/json" \
  -d "{\"user_id\":\"${UA}\",\"name\":\"B Vkladatel\",\"email\":\"rls-b2-${TS}@webdo24-test.cz\",\"phone\":\"+420000001\"}")
MSG=$(jq -r '.message // .error // .code // empty' /tmp/wd24_t2.json 2>/dev/null | head -c 150)
echo "      HTTP ${HTTP}: ${MSG}"
if [ "$HTTP" = "201" ]; then fail "Authenticated uživatel MŮŽE vkládat s cizím user_id (DÍRA)"; else pass "Auth insert cizího user_id blokován (HTTP ${HTTP}: ${MSG})"; fi

# [3] ANON bez session: SELECT záznamu A (cizí)
echo ""
echo "[3] ANON SELECT cizího záznamu A"
HTTP=$(curl -s -o /tmp/wd24_t3.json -w "%{http_code}" \
  "${API}/rest/v1/webdo24_customers?select=id,name,email,phone&id=eq.${CA}" \
  -H "apikey: ${ANON}")
ROWS=$(jq -r 'length' /tmp/wd24_t3.json 2>/dev/null)
echo "      HTTP ${HTTP}, řádků: ${ROWS}"
if [ "$HTTP" = "200" ] && [ "$ROWS" -ge 1 ]; then fail "ANON VIDÍ cizí záznamy (DÍRA)"; else pass "Anon nevidí cizí záznamy (${ROWS})"; fi

# [4] Authenticated B: SELECT záznamu A (cizí)
echo ""
echo "[4] Authenticated B SELECT záznamu A (cizí)"
HTTP=$(curl -s -o /tmp/wd24_t4.json -w "%{http_code}" \
  "${API}/rest/v1/webdo24_customers?select=id,name,email,phone&id=eq.${CA}" \
  -H "apikey: ${ANON}" -H "Authorization: Bearer ${ATB}")
ROWS=$(jq -r 'length' /tmp/wd24_t4.json 2>/dev/null)
echo "      HTTP ${HTTP}, řádků: ${ROWS}"
if [ "$HTTP" = "200" ] && [ "$ROWS" -ge 1 ]; then fail "Authenticated B VIDÍ cizí záznam A (DÍRA)"; else pass "Izolace SELECT funguje (${ROWS} řádků)"; fi

# [5] Authenticated A: SELECT vlastního záznamu (kontrola)
echo ""
echo "[5] Authenticated A SELECT vlastního záznamu"
HTTP=$(curl -s -o /tmp/wd24_t5.json -w "%{http_code}" \
  "${API}/rest/v1/webdo24_customers?select=id,name,email&id=eq.${CA}" \
  -H "apikey: ${ANON}" -H "Authorization: Bearer ${ATA}")
ROWS=$(jq -r 'length' /tmp/wd24_t5.json 2>/dev/null)
echo "      HTTP ${HTTP}, řádků: ${ROWS}"
if [ "$HTTP" = "200" ] && [ "$ROWS" -ge 1 ]; then pass "Vlastník vidí svůj záznam"; else fail "Vlastník NEVIDÍ svůj záznam (HTTP ${HTTP}, ${ROWS})"; fi

# [6] UPDATE cizího záznamu přes B
echo ""
echo "[6] Authenticated B UPDATE záznamu A (cizí)"
HTTP=$(curl -s -o /tmp/wd24_t6.json -w "%{http_code}" -X PATCH "${API}/rest/v1/webdo24_customers?id=eq.${CA}" \
  -H "apikey: ${ANON}" -H "Authorization: Bearer ${ATB}" -H "Content-Type: application/json" \
  -d "{\"name\":\"HACKED\"}")
MSG=$(jq -r '.message // .error // .code // empty' /tmp/wd24_t6.json 2>/dev/null | head -c 150)
echo "      HTTP ${HTTP}: ${MSG}"
if [ "$HTTP" = "204" ]; then fail "Authenticated B MŮŽE měnit cizí záznam (DÍRA)"; else pass "UPDATE cizího blokován (HTTP ${HTTP}: ${MSG})"; fi

# [7] UPDATE vlastního záznamu přes A (kontrola politiky customer_own_profile_update)
echo ""
echo "[7] Authenticated A UPDATE vlastního záznamu"
HTTP=$(curl -s -o /tmp/wd24_t7.json -w "%{http_code}" -X PATCH "${API}/rest/v1/webdo24_customers?id=eq.${CA}" \
  -H "apikey: ${ANON}" -H "Authorization: Bearer ${ATA}" -H "Content-Type: application/json" \
  -d "{\"name\":\"User A Updated\"}")
echo "      HTTP ${HTTP}"
if [ "$HTTP" = "204" ]; then pass "Vlastník může upravit svůj záznam"; else fail "Vlastník NEMŮŽE upravit záznam (HTTP ${HTTP})"; fi

# ÚKLID
echo ""
echo "[8] úklid"
[ -n "$CA" ] && curl -s -o /dev/null -w "DELETE customer A: HTTP %{http_code}\n" -X DELETE "${API}/rest/v1/webdo24_customers?id=eq.${CA}" -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}"
curl -s -o /dev/null -w "DELETE user A: HTTP %{http_code}\n" -X DELETE "${API}/auth/v1/admin/users/${UA}" -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}"
curl -s -o /dev/null -w "DELETE user B: HTTP %{http_code}\n" -X DELETE "${API}/auth/v1/admin/users/${UB}" -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}"
curl -s -o /dev/null -w "DELETE zbytky: HTTP %{http_code}\n" -X DELETE "${API}/rest/v1/webdo24_customers?email=like.rls-*" -H "apikey: ${SERVICE}" -H "Authorization: Bearer ${SERVICE}"

echo ""
echo "=== VÝSLEDEK: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT} ==="
for f in "${FAILURES[@]}"; do echo "  ✗ ${f}"; done
