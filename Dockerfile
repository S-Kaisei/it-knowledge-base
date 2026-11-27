# syntax=docker/dockerfile:1.10
# Multi-stage build: deps → dev / qa / builder → production
# Node.js version must match .node-version and the CI workflow (ADR-0002).
# Bun is the package manager / script runner; Node.js stays the JavaScript runtime (ADR-0010).
ARG NODE_VERSION=26.13.1
ARG BUN_VERSION=1.4.5
ARG NGINX_VERSION=1.31.7

FROM oven/bun:${BUN_VERSION}-debian AS bun

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
ENV BUN_INSTALL_CACHE_DIR=/home/node/.bun/install/cache
WORKDIR /app
# git: hooks and tests/harness create throw-away git repositories (needed in both web and qa).
RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/* \
 && ln -s /usr/local/bin/bun /usr/local/bin/bunx \
 && chown node:node /app

# ---------------------------------------------------------------------------
# deps: install exactly what bun.lock says (as the unprivileged "node" user)
FROM base AS deps
USER node
COPY --chown=node:node package.json bun.lock ./
RUN --mount=type=cache,target=/home/node/.bun/install/cache,uid=1000,gid=1000 bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# dev: Vite dev server with HMR. Source is bind-mounted by compose.yaml.
FROM deps AS dev
COPY --chown=node:node . .
EXPOSE 5173
CMD ["bun", "run", "dev"]

# ---------------------------------------------------------------------------
# qa: Playwright + Chromium. Browsers are installed by the same @playwright/test
# version that is in package-lock.json, so package and browser versions always match.
FROM deps AS qa
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN ./node_modules/.bin/playwright install --with-deps chromium \
 && chmod -R a+rX /ms-playwright \
 && rm -rf /var/lib/apt/lists/*
USER node
COPY --chown=node:node . .
ENV CI=true
CMD ["bun", "run", "verify"]

# ---------------------------------------------------------------------------
# builder: static site generation (build/client)
FROM deps AS builder
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
COPY --chown=node:node . .
RUN bun run build \
 && sed "s#__BASE_PATH__#${BASE_PATH}#g" docker/nginx.conf > /tmp/default.conf

# ---------------------------------------------------------------------------
# production: static files only, served by non-root nginx (no Node.js, no dev deps)
FROM nginxinc/nginx-unprivileged:${NGINX_VERSION}-alpine AS production
ARG BASE_PATH=/
COPY --from=builder /tmp/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build/client /usr/share/nginx/html${BASE_PATH}
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null "http://127.0.0.1:8080${BASE_PATH}" || exit 1
