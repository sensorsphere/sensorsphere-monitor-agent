# Changelog

## 1.0.3 - 2026-09-07

- Add a version-aware remote installer for Docker deployments.
- Preserve existing agent configuration while updating the requested image version.
- Download version-matched Compose and environment template files from GitHub.
- Auto-detect the GitHub repository URL for OCI source metadata when publishing locally.
- Document Git tags as the immutable source for versioned installations.

## 1.0.2 - 2026-09-07

- Switch the default Docker Compose file to pre-built image distribution instead of source builds.
- Add a source-build Compose overlay for development.
- Add multi-architecture release publishing for exact, major.minor and latest image tags.
- Add OCI image metadata and a canonical VERSION file.
- Document minimal remote installation and explicit image upgrades.

## 1.0.1 - 2026-09-06

- Remove `SENSORSPHERE_AGENT_ID`; the bearer token is now the sole agent identity.
- Make Docker Compose multi-instance friendly: no fixed container name, direct `--env-file` substitution, per-instance data directory, and runtime UID/GID mapping.

## 1.0.0 - 2026-09-06

Initial standalone SensorSphere Monitor Agent V1 baseline.

- Bearer-authenticated SensorSphere heartbeat, assigned-check polling and result submission.
- Revision-aware configuration reconciliation.
- PING executor with timeout, latency and overlap protection.
- Atomic local state persistence with backup recovery.
- Offline result queue with retention and size limits.
- Docker, native Node.js and systemd deployment support.
