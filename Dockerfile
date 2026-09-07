FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ARG AGENT_VERSION=dev
ARG OCI_SOURCE=unknown
ARG OCI_REVISION=unknown
LABEL org.opencontainers.image.title="SensorSphere Monitor Agent" \
      org.opencontainers.image.description="Standalone outbound-only monitoring agent for SensorSphere" \
      org.opencontainers.image.version="$AGENT_VERSION" \
      org.opencontainers.image.source="$OCI_SOURCE" \
      org.opencontainers.image.revision="$OCI_REVISION"
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get install -y --no-install-recommends iputils-ping ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data
USER node
CMD ["node", "dist/index.js"]
