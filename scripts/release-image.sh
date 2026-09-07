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
SOURCE="${OCI_SOURCE:-${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-unknown}}"
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
