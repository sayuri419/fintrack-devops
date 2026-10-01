#!/usr/bin/env bash
# Confirms Prometheus is scraping production and the alert rules are loaded.
set -euo pipefail
PROM="${PROM_URL:-http://prometheus:9090}"

for i in $(seq 1 20); do
  HEALTH=$(curl -fsS "${PROM}/api/v1/targets" | jq -r '.data.activeTargets[] | select(.labels.job=="fintrack-prod") | .health' || true)
  if [[ "$HEALTH" == "up" ]]; then
    echo ">> Prometheus target fintrack-prod is UP"
    break
  fi
  echo "   waiting for scrape target (attempt ${i}, state=${HEALTH:-unknown})"
  sleep 5
  [[ $i -eq 20 ]] && { echo "!! production target never came up"; exit 1; }
done

RULES=$(curl -fsS "${PROM}/api/v1/rules" | jq -r '.data.groups[].rules[].name' | paste -sd, -)
echo ">> Alert rules loaded: ${RULES}"

query() { curl -fsS --get "${PROM}/api/v1/query" --data-urlencode "query=$1" | jq -r '.data.result[0].value[1] // "n/a"'; }
echo ">> Live metrics from production:"
echo "   up                   = $(query 'up{job="fintrack-prod"}')"
echo "   request rate (req/s) = $(query 'sum(rate(fintrack_http_requests_total{job="fintrack-prod"}[1m]))')"
echo "   p95 latency (s)      = $(query 'histogram_quantile(0.95, sum(rate(fintrack_http_request_duration_seconds_bucket{job="fintrack-prod"}[5m])) by (le))')"
echo "   resident memory (B)  = $(query 'fintrack_process_resident_memory_bytes{job="fintrack-prod"}')"
