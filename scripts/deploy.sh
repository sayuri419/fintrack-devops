#!/usr/bin/env bash
# Usage: scripts/deploy.sh <staging|prod> <image-tag>
# Deploys the given image tag with Docker Compose, waits for the health check,
# runs smoke tests and automatically rolls back to the previous tag on failure.
set -euo pipefail

ENVIRONMENT="$1"
NEW_TAG="$2"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
CONTAINER="fintrack-${ENVIRONMENT}"
BASE_URL="http://${CONTAINER}:3000"
STATE_DIR="${STATE_DIR:-/var/jenkins_home/deploy-state}"
mkdir -p "$STATE_DIR"
LAST_GOOD_FILE="${STATE_DIR}/${ENVIRONMENT}.last-good"

PREVIOUS_TAG="$(cat "$LAST_GOOD_FILE" 2>/dev/null || true)"
echo ">> Deploying ${NEW_TAG} to ${ENVIRONMENT} (previous good: ${PREVIOUS_TAG:-none})"

compose_up() {
  IMAGE_TAG="$1" docker compose -f "$COMPOSE_FILE" up -d --remove-orphans --wait --wait-timeout 60
}

verify() {
  for i in $(seq 1 20); do
    if curl -fsS "${BASE_URL}/ready" >/dev/null 2>&1; then
      echo ">> ${CONTAINER} is ready (attempt ${i})"
      bash scripts/smoke-test.sh "$BASE_URL" "$NEW_TAG"
      return $?
    fi
    sleep 3
  done
  echo "!! ${CONTAINER} did not become ready"
  return 1
}

if compose_up "$NEW_TAG" && verify; then
  echo "$NEW_TAG" > "$LAST_GOOD_FILE"
  echo ">> ${ENVIRONMENT} deployment of ${NEW_TAG} succeeded"
  exit 0
fi

echo "!! Deployment failed - starting automatic rollback"
docker logs --tail 50 "$CONTAINER" || true
if [[ -n "$PREVIOUS_TAG" ]]; then
  compose_up "$PREVIOUS_TAG"
  echo ">> Rolled back ${ENVIRONMENT} to ${PREVIOUS_TAG}"
else
  echo "!! No previous version recorded; stopping the broken release"
  docker compose -f "$COMPOSE_FILE" down
fi
exit 1
