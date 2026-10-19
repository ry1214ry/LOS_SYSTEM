# ---- Build stage -------------------------------------------------------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Compile stage -----------------------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build first (needs devDependencies), then strip them for the runtime layer.
RUN npm run build \
 && npm prune --omit=dev \
 && npm cache clean --force

# ---- Runtime stage -----------------------------------------------------
FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS=--enable-source-maps

WORKDIR /app

# dumb-init gives us correct signal forwarding (SIGTERM → graceful shutdown).
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init \
 && rm -rf /var/lib/apt/lists/*

# Only production dependencies and compiled output ship in the final image.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json ./package.json

# Drop privileges: the official image already provides the unprivileged
# `node` user (uid 1000); the copy above already owns the files.
USER node

EXPOSE 3000

# Liveness only — readiness (which touches Postgres) is left to the orchestrator.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
