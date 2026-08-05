#!/usr/bin/env bash
# Run the production Docker Compose E2E gate from a Linux/WSL shell. This is
# intentionally separate from run-native-docker-e2e.ps1: artifacts identify
# their shell so a WSL/Linux result is never represented as Windows-native.

set -euo pipefail

usage() {
  printf '%s\n' \
    "Usage: $0 [--host-port PORT] [--health-timeout-seconds SECONDS]" \
    "" \
    "Runs host-side Playwright against the production Docker Compose service." \
    "Compose is intentionally left running after success or failure for review."
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

is_positive_integer() {
  [[ "$1" =~ ^[0-9]+$ ]] && ((10#$1 >= 1))
}

is_valid_port() {
  is_positive_integer "$1" && ((10#$1 <= 65535))
}

host_port=18080
health_timeout_seconds=120

while (($# > 0)); do
  case "$1" in
    --host-port)
      (($# >= 2)) || die "--host-port requires a value."
      host_port="$2"
      shift 2
      ;;
    --health-timeout-seconds)
      (($# >= 2)) || die "--health-timeout-seconds requires a value."
      health_timeout_seconds="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      die "Unknown argument: $1"
      ;;
  esac
done

is_valid_port "$host_port" || die "--host-port must be an integer from 1 to 65535."
is_positive_integer "$health_timeout_seconds" ||
  die "--health-timeout-seconds must be a positive integer."

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repository_root="$(cd -- "$script_directory/.." && pwd -P)"
compose_file="$repository_root/compose.yaml"

[[ -f "$compose_file" ]] || die "compose.yaml was not found at $compose_file."

run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
artifact_root="$repository_root/test-results/wsl-docker-e2e/$run_id"
test_results_directory="$artifact_root/test-results"
html_report_directory="$artifact_root/playwright-report"
base_url="http://127.0.0.1:$host_port"
health_url="$base_url/api/health"
docker_compose_available=false

mkdir -p "$artifact_root"

compose() {
  docker compose -f "$compose_file" "$@"
}

capture_failure_evidence() {
  {
    printf 'runner=run-wsl-docker-e2e.sh\n'
    printf 'status=failed\n'
    printf 'base_url=%s\n' "$base_url"
    if [[ "$docker_compose_available" == "true" ]]; then
      compose ps || true
    else
      printf 'Docker Compose was unavailable before the runner could start it.\n'
    fi
  } >"$artifact_root/docker-compose-ps-failure.txt" 2>&1

  {
    if [[ "$docker_compose_available" == "true" ]]; then
      compose logs --tail 200 app || true
    else
      printf 'Docker Compose was unavailable; no application logs were collected.\n'
    fi
  } >"$artifact_root/docker-compose-app-failure.log" 2>&1
}

on_exit() {
  local status=$?

  if ((status != 0)); then
    capture_failure_evidence
  fi

  if [[ "$docker_compose_available" == "true" ]]; then
    printf 'Compose is intentionally left running for review at %s.\n' "$base_url"
  fi
  printf 'Artifacts: %s\n' "$artifact_root"

  trap - EXIT
  exit "$status"
}

trap on_exit EXIT

command -v node >/dev/null 2>&1 || die "Node.js is required."
node_platform="$(node -p 'process.platform')"
if [[ "$node_platform" != "linux" ]]; then
  die "This runner requires Linux/WSL Node. node -p process.platform returned '$node_platform'."
fi

node_version="$(node -p 'process.versions.node')"
if [[ ! "$node_version" =~ ^24\. ]]; then
  die "This runner requires Node.js 24.x from package.json. node -p process.versions.node returned '$node_version'."
fi

command -v npx >/dev/null 2>&1 || die "npx is required to run the installed Playwright package."
command -v docker >/dev/null 2>&1 || die "Docker Compose is required for the WSL/Linux Docker E2E run."
if ! compose version >"$artifact_root/docker-compose-version.txt" 2>&1; then
  {
    printf 'Docker CLI was found, but Docker Compose is not usable from this Linux/WSL shell.\n'
    printf 'The runner did not start Compose, switch Docker contexts, or change Docker Desktop integration.\n'
    printf 'Enable the intended Linux/WSL Docker integration outside this runner, then retry; otherwise use the native Windows runner.\n'
    printf '\nThe original Compose error is saved in docker-compose-version.txt.\n'
  } >"$artifact_root/docker-daemon-diagnostic.txt" 2>&1
  die "Docker Compose is unavailable in this Linux/WSL shell. See $artifact_root/docker-daemon-diagnostic.txt."
fi

# A Docker CLI can exist in WSL while its daemon is reachable only from another
# distribution or native Windows. Fail before `compose up` in that case. This
# runner deliberately does not switch Docker contexts or alter Docker Desktop
# integration: that is an operator/environment decision, not project setup.
if ! docker info >"$artifact_root/docker-info.txt" 2>&1; then
  {
    printf 'Docker CLI is installed, but no usable daemon is reachable from this Linux/WSL shell.\n'
    printf 'The runner did not start Compose, switch Docker contexts, or change Docker Desktop integration.\n'
    printf 'Enable the intended Linux/WSL Docker daemon outside this runner, then retry; otherwise use the native Windows runner.\n'
    printf '\nCurrent Docker context (best effort):\n'
    docker context show || true
    printf '\nAvailable Docker contexts (best effort):\n'
    docker context ls || true
    printf '\nOriginal docker info error is saved in docker-info.txt.\n'
  } >"$artifact_root/docker-daemon-diagnostic.txt" 2>&1
  die "Docker daemon is unavailable in this Linux/WSL shell. See $artifact_root/docker-daemon-diagnostic.txt."
fi
docker_compose_available=true

# The child process owns these exports, so no calling-shell environment is
# mutated. Compose interpolation prefers these empty values over a developer
# .env file, keeping this black-box evidence on deterministic authored
# fallbacks rather than external Firebase or provider state.
export APP_PORT="$host_port"
export PLAYWRIGHT_BASE_URL="$base_url"
export PLAYWRIGHT_HTML_OUTPUT_DIR="$html_report_directory"
export PLAYWRIGHT_CAPTURE_VIDEO="true"
export VITE_ENABLE_E2E_BRIDGE="false"
export PLAYWRIGHT_PRODUCTION_E2E="true"
export VITE_API_BASE_URL="/api"
export VITE_FIREBASE_API_KEY=""
export VITE_FIREBASE_AUTH_DOMAIN=""
export VITE_FIREBASE_PROJECT_ID=""
export VITE_FIREBASE_APP_ID=""
export VITE_USE_FIREBASE_EMULATORS="false"
export VITE_FIREBASE_AUTH_EMULATOR_URL=""
export VITE_FIREBASE_FIRESTORE_EMULATOR_HOST=""
export VITE_FIREBASE_FIRESTORE_EMULATOR_PORT=""
export GEMINI_API_KEY=""
export GOOGLE_MAPS_API_KEY=""

{
  printf 'runner=run-wsl-docker-e2e.sh\n'
  printf 'node_platform=%s\n' "$node_platform"
  printf 'node_version=%s\n' "$node_version"
  printf 'base_url=%s\n' "$base_url"
  compose version
} >"$artifact_root/runtime.txt"

printf 'Starting Docker Compose with APP_PORT=%s ...\n' "$APP_PORT"
compose up --build -d

poll_health() {
  local deadline=$((SECONDS + health_timeout_seconds))
  local temporary_health_file="$artifact_root/health.json.tmp"
  local poll_log="$artifact_root/health-poll.log"

  while ((SECONDS < deadline)); do
    if HEALTH_URL="$health_url" node --input-type=module -e '
const url = process.env.HEALTH_URL;
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  const health = JSON.parse(body);
  if (health.status !== "ok") {
    throw new Error(`Unexpected health payload: ${body}`);
  }
  process.stdout.write(`${JSON.stringify(health, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
' >"$temporary_health_file" 2>>"$poll_log"; then
      mv "$temporary_health_file" "$artifact_root/health.json"
      return 0
    fi

    sleep 2
  done

  rm -f "$temporary_health_file"
  return 1
}

if ! poll_health; then
  die "Health endpoint did not return status 'ok' before the $health_timeout_seconds-second deadline: $health_url"
fi

compose ps | tee "$artifact_root/docker-compose-ps.txt"
printf 'Health check passed: %s (saved to %s/health.json)\n' "$health_url" "$artifact_root"
printf 'Running one-worker Playwright E2E against %s ...\n' "$PLAYWRIGHT_BASE_URL"
npx --no-install playwright test \
  "--output=$test_results_directory" \
  "--project=chromium-desktop" \
  "--project=chromium-mobile" \
  "--workers=1"

printf 'WSL/Linux Docker E2E PASS\n'
