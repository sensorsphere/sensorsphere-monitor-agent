#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="${REPOSITORY:-sensorsphere/sensorsphere-monitor-agent}"
RAW_BASE_URL="${RAW_BASE_URL:-https://raw.githubusercontent.com}"
VERSION="${VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-${HOME}/sensorsphere-monitor-agent}"
IMAGE="${MONITOR_AGENT_IMAGE:-ghcr.io/sensorsphere/sensorsphere-monitor-agent}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

for command_name in curl docker mktemp; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done

docker compose version >/dev/null 2>&1 || fail "docker compose plugin is required"

if [[ "$VERSION" == "latest" ]]; then
  SOURCE_REF="master"
  IMAGE_TAG="latest"
elif [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  SOURCE_REF="v${VERSION}"
  IMAGE_TAG="$VERSION"
else
  fail "VERSION must be 'latest' or a semantic version such as 1.0.3"
fi

ensure_install_dir() {
  if mkdir -p "$INSTALL_DIR/data" 2>/dev/null; then
    return
  fi

  command -v sudo >/dev/null 2>&1 || fail "Cannot create $INSTALL_DIR and sudo is unavailable"
  sudo mkdir -p "$INSTALL_DIR/data"
  sudo chown -R "$(id -u):$(id -g)" "$INSTALL_DIR"
}

ensure_install_dir

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

printf 'Installing SensorSphere Monitor Agent\n'
printf '  version:      %s\n' "$VERSION"
printf '  source ref:   %s\n' "$SOURCE_REF"
printf '  install dir:  %s\n' "$INSTALL_DIR"
printf '  image:        %s:%s\n' "$IMAGE" "$IMAGE_TAG"

curl -fsSL \
  "${RAW_BASE_URL}/${REPOSITORY}/${SOURCE_REF}/docker-compose.yml" \
  -o "$TMP_DIR/docker-compose.yml"

curl -fsSL \
  "${RAW_BASE_URL}/${REPOSITORY}/${SOURCE_REF}/.env.example" \
  -o "$TMP_DIR/.env.example"

cp "$TMP_DIR/docker-compose.yml" "$INSTALL_DIR/docker-compose.yml"
cp "$TMP_DIR/.env.example" "$INSTALL_DIR/.env.example"

if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  printf 'Created %s/.env from .env.example\n' "$INSTALL_DIR"
else
  printf 'Preserving existing %s/.env\n' "$INSTALL_DIR"
fi

IMAGE_VALUE="${IMAGE}:${IMAGE_TAG}"
if grep -q '^MONITOR_AGENT_IMAGE=' "$INSTALL_DIR/.env"; then
  sed -i "s|^MONITOR_AGENT_IMAGE=.*|MONITOR_AGENT_IMAGE=${IMAGE_VALUE}|" "$INSTALL_DIR/.env"
else
  printf '\n# Image version selected by scripts/install.sh\nMONITOR_AGENT_IMAGE=%s\n' "$IMAGE_VALUE" >> "$INSTALL_DIR/.env"
fi

PUID="$(id -u)" PGID="$(id -g)" \
  docker compose \
    --env-file "$INSTALL_DIR/.env.example" \
    -f "$INSTALL_DIR/docker-compose.yml" \
    config -q

cat <<EOF

Installation files are ready.

Edit the required SensorSphere settings:
  ${INSTALL_DIR}/.env

At minimum configure:
  SENSORSPHERE_URL
  SENSORSPHERE_AGENT_TOKEN

Then start the agent:
  cd ${INSTALL_DIR}
  PUID=\$(id -u) PGID=\$(id -g) docker compose --env-file .env pull
  PUID=\$(id -u) PGID=\$(id -g) docker compose --env-file .env up -d

Follow logs with:
  PUID=\$(id -u) PGID=\$(id -g) docker compose --env-file .env logs -f monitor-agent

EOF
