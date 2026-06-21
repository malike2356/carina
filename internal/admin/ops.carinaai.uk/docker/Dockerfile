FROM node:22-alpine AS build
WORKDIR /app
ENV CI=true
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds 2>/dev/null \
  || pnpm install --dangerously-allow-all-builds
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/views ./views
COPY --from=build /app/public ./public
EXPOSE 4001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
