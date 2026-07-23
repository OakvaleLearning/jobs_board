# syntax=docker/dockerfile:1
# Multi-stage production image for the Fastify backend.
# TypeScript is compiled at build time (tsc + tsc-alias); the runtime image runs
# plain Node on the emitted dist/ — no tsx, no dev deps, no source mounts.
# node:22-slim (Debian) is used over Alpine to keep the native deps
# (@node-rs/argon2, sharp) on prebuilt glibc binaries.

# ---- deps: clean, reproducible workspace install ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

# ---- build: compile TypeScript to dist/ ----
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend ./backend
COPY packages ./packages
WORKDIR /app/backend
# tsc + tsc-alias: aliases (@/...) are rewritten to relative paths HERE, at build
# time, so nothing needs tsc-alias at runtime. This is the permanent fix for the
# previous "tsc-alias: not found" restart loop.
RUN npm run build

# ---- runtime: lean prod-only image running compiled JS ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --omit=dev
# Compiled output: dist/backend/src/** and dist/packages/shared/src/**
COPY --from=build /app/backend/dist ./backend/dist
WORKDIR /app/backend
EXPOSE 3000
# Apply migrations from the compiled migrate script (no tsx needed), then start
# the compiled server. Seeds are run manually, also from dist (see DEPLOYMENT.md).
CMD ["sh", "-c", "node dist/backend/src/shared/db/migrate.js && node dist/backend/src/app.js"]
