FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/
COPY packages/shared/package.json ./packages/shared/

RUN npm install

COPY tsconfig.base.json ./
COPY frontend ./frontend
COPY packages ./packages

WORKDIR /app/frontend

EXPOSE 3000

CMD ["npx", "next", "dev", "-p", "3000", "-H", "0.0.0.0"]
