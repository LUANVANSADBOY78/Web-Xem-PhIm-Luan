# Stage 1: Build React App Frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Production Server Environment
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_FILE=/data/data.json

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

# Copy optimized build assets, server & required files
COPY --from=builder /app/build ./build
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/navigation.json ./src/navigation.json

# Prepare volume directory for persistent data.json
RUN mkdir -p /data && chown -R node:node /app /data

VOLUME ["/data"]

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server/index.js"]
