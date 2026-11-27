# syntax=docker/dockerfile:1.10
# Multi-stage build: deps → dev / qa / builder → production
# Node.js version must match .node-version and the CI workflow (ADR-0002).
ARG NODE_VERSION=26.13.1
ARG NGINX_VERSION=1.31.7

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false
WORKDIR /app
RUN chown node:node /app

# ---------------------------------------------------------------------------
# deps: install exactly what package-lock.json says (as the unprivileged "node" user)
FROM base AS deps
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 npm ci

# ---------------------------------------------------------------------------
# dev: Vite dev server with HMR. Source is bind-mounted by compose.yaml.
FROM deps AS dev
COPY --chown=node:node . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# qa: Playwright + Chromium. Browsers are installed by the same @playwright/test
# version that is in package-lock.json, so package and browser versions always match.
FROM deps AS qa
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium \
 && chmod -R a+rX /ms-playwright \
 && rm -rf /var/lib/apt/lists/*
USER node
COPY --chown=node:node . .
ENV CI=true
CMD ["npm", "run", "verify"]

# ---------------------------------------------------------------------------
# builder: static site generation (build/client)
FROM deps AS builder
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
COPY --chown=node:node . .
RUN npm run build \
 && sed "s#__BASE_PATH__#${BASE_PATH}#g" docker/nginx.conf > /tmp/default.conf

# ---------------------------------------------------------------------------
# production: static files only, served by non-root nginx (no Node.js, no dev deps)
FROM nginxinc/nginx-unprivileged:${NGINX_VERSION}-alpine AS production
ARG BASE_PATH=/
COPY --from=builder /tmp/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build/client /usr/share/nginx/html${BASE_PATH}
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null "http://127.0.0.1:8080${BASE_PATH}" || exit 1
