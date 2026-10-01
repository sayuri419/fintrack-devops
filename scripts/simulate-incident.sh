#!/usr/bin/env bash
# Incident drill: injects 5xx errors into production, proves the HighErrorRate alert
# fires in Prometheus, is routed by Alertmanager and reaches the on-call webhook,
# then removes the fault and confirms the alert resolves.
set -euo pipefail

APP="${APP_URL:-http://fintrack-prod:3000}"
AM="${ALERTMANAGER_URL:-http://alertmanager:9093}"
LOGGER="${ALERT_LOGGER_URL:-http://alert-logger:5001}"
: "${CHAOS_TOKEN:?CHAOS_TOKEN must be set}"

set_chaos() {
  curl -fsS -X POST "${APP}/chaos" -H "X-Chaos-Token: ${CHAOS_TOKEN}" \
    -H 'Content-Type: application/json' -d "{\"errorRate\":$1}" >/dev/null
}
traffic() {
  local end=$((SECONDS + $1))
  while (( SECONDS < end )); do
    curl -s -o /dev/null -X POST "${APP}/api/v1/auth/login" -H 'Content-Type: application/json' \
      -d '{"email":"drill@example.com","password":"x"}' || true
    sleep 0.2
  done
}
alert_state() {
  curl -fsS "${AM}/api/v2/alerts?filter=alertname=%22FinTrackHighErrorRate%22" | jq -r '.[0].status.state // "none"'
}

trap 'set_chaos 0 || true' EXIT

echo ">> [1/4] Injecting faults: 60% of API requests will return HTTP 500"
set_chaos 0.6

echo ">> [2/4] Generating traffic until the alert fires (max ~4 min)"
FIRED=false
for i in $(seq 1 16); do
  traffic 15
  STATE=$(alert_state)
  echo "   t+$((i * 15))s alertmanager state: ${STATE}"
  if [[ "$STATE" == "active" ]]; then FIRED=true; break; fi
done
[[ "$FIRED" == "true" ]] || { echo "!! Alert never fired - monitoring is NOT working"; exit 1; }
echo ">> ALERT FIRING: FinTrackHighErrorRate (severity=critical)"

echo ">> [3/4] Checking the on-call webhook received the notification"
sleep 10
curl -fsS "${LOGGER}/alerts" | jq '.[-1] | {status, alerts: [.alerts[] | {alertname: .labels.alertname, severity: .labels.severity, summary: .annotations.summary}]}'

echo ">> [4/4] Removing fault and waiting for recovery"
set_chaos 0
for i in $(seq 1 20); do
  traffic 15
  STATE=$(alert_state)
  echo "   recovery check ${i}: ${STATE}"
  [[ "$STATE" == "none" ]] && { echo ">> Alert resolved - incident drill complete"; exit 0; }
done
echo "!! Alert still active after recovery window"
exit 1
