# ---- Stage 1: install production dependencies only ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---- Stage 2: minimal runtime image ----
FROM node:20-alpine AS runtime
ARG APP_VERSION=dev
ARG GIT_COMMIT=local
LABEL org.opencontainers.image.title="fintrack-api" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}"

ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    GIT_COMMIT=${GIT_COMMIT} \
    PORT=3000

# Patch OS packages and remove npm/yarn: they are not needed at runtime and their
# bundled dependencies are a frequent source of Trivy HIGH findings.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json build-info.json* ./
COPY src ./src

# Run as the unprivileged "node" user, never root.
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ready || exit 1

CMD ["node", "src/server.js"]
