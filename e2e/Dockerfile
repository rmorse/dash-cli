ARG NODE_VERSION=24.13.0
FROM node:${NODE_VERSION}-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm link

ENV HOME=/tmp/dash-home

CMD ["sh", "e2e/run.sh"]
