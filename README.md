# SensorSphere Monitor Agent

Standalone outbound-only monitoring agent for SensorSphere. V1 executes assigned `PING` checks and reports results through the SensorSphere Monitoring API. It exposes no inbound management port and requires no inbound firewall/NAT rule.

Version: **1.0.2**

## Requirements

- Node.js 20+ for native execution (Node.js 22 recommended)
- `ping` available on the host (`iputils-ping` on Debian/Ubuntu)
- Network access from the agent to the configured SensorSphere URL

Docker images install `iputils-ping` automatically.

## Required configuration

Copy `.env.example` to `.env` for Docker, or provide the same variables in the native environment.

```env
SENSORSPHERE_URL=http://100.64.0.8:8080
SENSORSPHERE_AGENT_TOKEN=ssma_replace_me
```

SensorSphere derives the agent identity exclusively from the bearer token. No URL or token is defaulted, and the raw token is never logged.

## Native Node.js

```bash
npm install
npm run build
node dist/index.js
```

For a native installation, set `SENSORSPHERE_STATE_FILE` to a writable host path, for example:

```env
SENSORSPHERE_STATE_FILE=/var/lib/sensorsphere-monitor-agent/monitor-agent-state.json
```

## Docker distribution

The default `docker-compose.yml` is the production/distribution compose file. It pulls a pre-built image and does not require Node.js, npm, Git or the source tree on the target machine.

Create a deployment directory:

```bash
mkdir -p sensorsphere-monitor-agent/data
cd sensorsphere-monitor-agent
# copy docker-compose.yml and .env.example from the release bundle
cp .env.example .env
```

Configure at minimum:

```env
MONITOR_AGENT_IMAGE=ghcr.io/YOUR_GITHUB_ORG/sensorsphere-monitor-agent:1.0.2
SENSORSPHERE_URL=http://100.64.0.8:8080
SENSORSPHERE_AGENT_TOKEN=ssma_replace_me
DATA_DIR=./data
```

Then start the agent with the UID/GID of the account owning the data directory:

```bash
PUID=$(id -u) PGID=$(id -g) docker compose --env-file .env pull
PUID=$(id -u) PGID=$(id -g) docker compose --env-file .env up -d
PUID=$(id -u) PGID=$(id -g) docker compose --env-file .env logs -f monitor-agent
```

Pin `MONITOR_AGENT_IMAGE` to an exact release in production. Updating is then explicit:

```bash
# change MONITOR_AGENT_IMAGE to the desired release first
PUID=$(id -u) PGID=$(id -g) docker compose --env-file .env pull
PUID=$(id -u) PGID=$(id -g) docker compose --env-file .env up -d
```

Compose does not set a fixed `container_name`; distinct Compose project names and data directories can therefore run multiple agents on the same host.

### Local source build

Development/source builds use the overlay `docker-compose.build.yml`:

```bash
PUID=$(id -u) PGID=$(id -g) docker compose --env-file .env \
  -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

### Publishing release images

`VERSION` is the canonical image release version. `scripts/release-image.sh` publishes a multi-architecture image for `linux/amd64` and `linux/arm64` with three tags: exact version, `major.minor`, and `latest`.

Authenticate to the registry first, then run for example:

```bash
export IMAGE_NAMESPACE=my-github-org
./scripts/release-image.sh
```

For version `1.0.2`, the published tags are:

```text
ghcr.io/my-github-org/sensorsphere-monitor-agent:1.0.2
ghcr.io/my-github-org/sensorsphere-monitor-agent:1.0
ghcr.io/my-github-org/sensorsphere-monitor-agent:latest
```

The registry and image name remain configurable through `REGISTRY`, `IMAGE_NAMESPACE` and `IMAGE_NAME`. OCI source/revision labels are added to the image.

## systemd example

A hardened example unit is provided in `systemd/sensorsphere-monitor-agent.service` and assumes:

- application: `/opt/sensorsphere-monitor-agent`
- environment: `/etc/sensorsphere-monitor-agent.env`
- persistent data: `/var/lib/sensorsphere-monitor-agent`
- service account: `sensorsphere-monitor`

Example Debian/Ubuntu installation after copying the repository to `/opt/sensorsphere-monitor-agent`:

```bash
sudo apt-get update
sudo apt-get install -y nodejs npm iputils-ping ca-certificates
sudo useradd --system --home /var/lib/sensorsphere-monitor-agent --shell /usr/sbin/nologin sensorsphere-monitor || true
sudo mkdir -p /var/lib/sensorsphere-monitor-agent
sudo chown sensorsphere-monitor:sensorsphere-monitor /var/lib/sensorsphere-monitor-agent
cd /opt/sensorsphere-monitor-agent
sudo npm install
sudo npm run build
sudo cp systemd/sensorsphere-monitor-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sensorsphere-monitor-agent
sudo journalctl -u sensorsphere-monitor-agent -f
```

Set this in `/etc/sensorsphere-monitor-agent.env` for the systemd unit:

```env
SENSORSPHERE_STATE_FILE=/var/lib/sensorsphere-monitor-agent/monitor-agent-state.json
```

## Runtime workflow

1. Send an authenticated heartbeat.
2. Compare SensorSphere `configRevision` to the locally cached revision.
3. Fetch assigned checks when configuration needs reconciliation.
4. Keep stable schedules when unchanged, replace changed schedules, add new schedules and remove unassigned schedules.
5. Execute supported checks locally without overlapping executions of the same check.
6. Submit results to SensorSphere.
7. If SensorSphere is unavailable, continue cached checks and persist failed submissions to the local queue.
8. Flush queued results in batches of at most 1000 after connectivity returns.

V1 implements only `PING`. `TCP`, `HTTP` and `HTTPS` remain represented by the API contract and can be added through the generic `CheckExecutor` interface.

## Persistence safety

The state file contains the last valid assigned-check configuration and any offline result backlog. Writes use a temporary file followed by rename. The previous primary file is kept as `.bak` before replacement.

If the primary file is corrupt, the agent attempts recovery from a valid backup. If both are invalid, startup fails rather than silently replacing existing invalid state with defaults.

The offline queue is bounded by both maximum result count and retention age.

## Validation

```bash
npm run check
```

## Security notes

- Monitoring API calls use `Authorization: Bearer <token>`.
- The raw token is never emitted in logs.
- There is no agent HTTP UI or inbound management listener in V1.
- TLS certificate verification uses the secure Node.js default and is not disabled by the agent.
