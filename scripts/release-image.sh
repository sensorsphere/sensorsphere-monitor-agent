#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="$(tr -d '[:space:]' < VERSION)"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid VERSION: $VERSION" >&2
  exit 1
fi

REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:?Set IMAGE_NAMESPACE, for example your GitHub organization or username}"
IMAGE_NAME="${IMAGE_NAME:-sensorsphere-monitor-agent}"
IMAGE="${REGISTRY}/${IMAGE_NAMESPACE}/${IMAGE_NAME}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
detect_source() {
  if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
    printf '%s/%s\n' "${GITHUB_SERVER_URL:-https://github.com}" "$GITHUB_REPOSITORY"
    return
  fi

  local remote
  remote="$(git config --get remote.origin.url 2>/dev/null || true)"
  case "$remote" in
    git@github.com:*)
      remote="https://github.com/${remote#git@github.com:}"
      ;;
    ssh://git@github.com/*)
      remote="https://github.com/${remote#ssh://git@github.com/}"
      ;;
  esac

  remote="${remote%.git}"
  if [[ "$remote" == https://github.com/* ]]; then
    printf '%s\n' "$remote"
  else
    printf '%s\n' "unknown"
  fi
}

SOURCE="${OCI_SOURCE:-$(detect_source)}"
REVISION="${OCI_REVISION:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
MINOR="${VERSION%.*}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if ! docker buildx version >/dev/null 2>&1; then
  echo "docker buildx is required" >&2
  exit 1
fi

echo "Publishing $IMAGE"
echo "  version:   $VERSION"
echo "  platforms: $PLATFORMS"
echo "  revision:  $REVISION"

docker buildx build \
  --platform "$PLATFORMS" \
  --build-arg "AGENT_VERSION=$VERSION" \
  --build-arg "OCI_SOURCE=$SOURCE" \
  --build-arg "OCI_REVISION=$REVISION" \
  --tag "$IMAGE:$VERSION" \
  --tag "$IMAGE:$MINOR" \
  --tag "$IMAGE:latest" \
  --push \
  .
