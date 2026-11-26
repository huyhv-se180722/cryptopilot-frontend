# syntax=docker/dockerfile:1.7
# CryptoPilot web image (T-004): the production build served by nginx.
# The backend addresses are compiled in (Vite); a production build accepts only https and wss:
#   docker build -t cryptopilot-web \
#     --build-arg VITE_API_BASE_URL=https://staging.example.com/api/v1 \
#     --build-arg VITE_WS_URL=wss://staging.example.com/ws .

FROM node:22.23.5-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_WS_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_WS_URL=$VITE_WS_URL VITE_ENABLE_DEV_FIXTURES=false
RUN test -n "$VITE_API_BASE_URL" || (echo "VITE_API_BASE_URL is required" >&2; exit 1) \
    && npx vite build

# T-095: the stable nginx line with Alpine's security updates (Trivy HIGH findings in curl, c-ares, brotli on
# 1.29-alpine; nothing in the site itself).
FROM nginx:1.30.8-alpine
RUN apk upgrade --no-cache
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
