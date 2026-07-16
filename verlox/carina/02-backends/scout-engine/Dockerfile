FROM node:22-bookworm-slim AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ARG BUILD_REVISION=unknown
ARG BUILD_TIME=unknown
ENV NODE_ENV=production
ENV BUILD_REVISION=${BUILD_REVISION}
ENV BUILD_TIME=${BUILD_TIME}
COPY --from=builder /build/package.json ./
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
EXPOSE 4455
CMD ["node", "dist/server.js"]
