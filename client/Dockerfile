# Build client lalu sajikan statis lewat Caddy (auto-HTTPS Let's Encrypt).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv/caddy
COPY Caddyfile /etc/caddy/Caddyfile
