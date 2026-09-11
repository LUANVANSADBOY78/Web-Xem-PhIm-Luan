FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/server ./server
RUN mkdir -p /data && chown node:node /data
ENV HOST=0.0.0.0 PORT=3000 DATA_FILE=/data/data.json
VOLUME /data
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
