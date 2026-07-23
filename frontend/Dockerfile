# syntax=docker/dockerfile:1
# Multi-stage production image for the Next.js frontend.
# Build output is baked into the image — no source bind-mounts, no `next dev` in prod.

# ---- deps: clean, reproducible workspace install ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

# ---- build: compile the Next app ----
FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* is inlined into the client bundle at build time, so it MUST be
# present here (passed via compose build.args), not just at runtime.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY frontend ./frontend
COPY packages ./packages
WORKDIR /app/frontend
RUN npm run build

# ---- runtime: lean prod-only image running `next start` ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --omit=dev
COPY packages ./packages
COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/frontend/next.config.mjs ./frontend/next.config.mjs
WORKDIR /app/frontend
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
