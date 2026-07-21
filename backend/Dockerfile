FROM node:22-alpine

WORKDIR /app

# Install workspace manifests first for layer caching
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY packages/shared/package.json ./packages/shared/

RUN npm install

COPY tsconfig.base.json ./
COPY backend ./backend
COPY packages ./packages

WORKDIR /app/backend

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npx tsx watch src/app.ts"]
