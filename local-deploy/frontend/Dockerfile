# =============================================================================
# Merkoteks Frontend — multi-stage: yarn build → nginx serve
# =============================================================================

# ---- Stage 1: build React app -----------------------------------------------
FROM node:20-bookworm-slim AS builder

WORKDIR /build

# Yarn install
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 300000

# App source
COPY frontend/ ./

# Build with EMPTY REACT_APP_BACKEND_URL → axios calls become relative
# (baseURL becomes `/api`, served by nginx same-origin)
ENV REACT_APP_BACKEND_URL=""
ENV DISABLE_ESLINT_PLUGIN=true
ENV CI=false
RUN yarn build

# ---- Stage 2: nginx runtime -------------------------------------------------
FROM nginx:1.27-alpine

# Nginx config (proxy /api → backend, serve SPA at /)
COPY local-deploy/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts
COPY --from=builder /build/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
