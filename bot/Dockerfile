FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY bot/package.json ./
RUN npm install

COPY bot/ ./
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/index.js"]
