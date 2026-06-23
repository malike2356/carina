FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds 2>/dev/null \
  || pnpm install --dangerously-allow-all-builds

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4100
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache tini
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 4100
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
