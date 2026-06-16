FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY bot/package.json ./bot/
COPY web/package.json ./web/

RUN npm ci --workspace=bot --omit=dev

COPY bot/ ./bot/

WORKDIR /app/bot
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/index.js"]
