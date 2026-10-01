#!/usr/bin/env bash
# Post-deployment smoke test: proves the deployed container is the expected version
# and that the main user journey (register -> add transaction -> report) works.
set -euo pipefail

BASE_URL="$1"
EXPECTED_VERSION="${2:-}"
EMAIL="smoke-$(date +%s)-$RANDOM@example.com"

echo ">> Smoke testing ${BASE_URL}"

HEALTH=$(curl -fsS "${BASE_URL}/health")
echo "   health: ${HEALTH}"
if [[ -n "$EXPECTED_VERSION" ]] && ! grep -q "\"version\":\"${EXPECTED_VERSION}\"" <<<"$HEALTH"; then
  echo "!! Version mismatch - expected ${EXPECTED_VERSION}"
  exit 1
fi

TOKEN=$(curl -fsS -X POST "${BASE_URL}/api/v1/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"Smok3Test!\",\"name\":\"Smoke\"}" | jq -r .token)
[[ -n "$TOKEN" && "$TOKEN" != "null" ]] || { echo "!! register failed"; exit 1; }

MONTH=$(date +%Y-%m)
curl -fsS -X POST "${BASE_URL}/api/v1/transactions" -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"expense\",\"amount\":12.5,\"category\":\"groceries\",\"date\":\"${MONTH}-01\"}" >/dev/null

COUNT=$(curl -fsS "${BASE_URL}/api/v1/reports/summary?month=${MONTH}" -H "Authorization: Bearer ${TOKEN}" | jq .transactionCount)
[[ "$COUNT" == "1" ]] || { echo "!! report check failed (count=${COUNT})"; exit 1; }

curl -fsS "${BASE_URL}/metrics" | grep -q fintrack_http_requests_total || { echo "!! metrics missing"; exit 1; }
echo ">> Smoke tests passed"
