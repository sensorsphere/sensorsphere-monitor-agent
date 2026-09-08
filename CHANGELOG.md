# Changelog

## 1.0.6 - 2026-09-08

- Add optional `AGENT_NAME` for a stable human-readable monitoring-agent instance name.
- Send `X-SensorSphere-Agent-Name` on every SensorSphere HTTP request when `AGENT_NAME` is configured.
- Log the resolved `AGENT_NAME` at startup; the header remains diagnostic-only and does not participate in authentication.

## 1.0.5 - 2026-09-07

- Add comma-separated `AGENT_LABELS` reported by the agent to SensorSphere on every heartbeat.
- Trim labels, remove empty entries and preserve only the first occurrence of duplicates.
- Keep agent-reported labels distinct from SensorSphere-managed monitoring-agent labels.
- Show the resolved `AGENT_LABELS` value in startup diagnostics.

## 1.0.4 - 2026-09-07

- Log runtime identity, data directory and resolved SensorSphere configuration at agent startup.
- Mask the agent token in startup diagnostics, keeping only the first 13 and last 8 characters.
- Persist PUID and PGID into newly created installer environment files, honoring explicit installer overrides.
- Simplify post-install Compose commands because UID/GID are now stored in `.env`.

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
