FROM node:22-alpine AS deps
WORKDIR /workspace/console.labyrinthscout.com
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY console.labyrinthscout.com/package.json console.labyrinthscout.com/pnpm-lock.yaml ./
COPY core.carinaai.uk/packages/transport /workspace/core.carinaai.uk/packages/transport
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds 2>/dev/null \
  || pnpm install --dangerously-allow-all-builds

FROM deps AS build
COPY console.labyrinthscout.com/package.json console.labyrinthscout.com/pnpm-lock.yaml console.labyrinthscout.com/tsconfig.json ./
COPY console.labyrinthscout.com/scripts ./scripts
COPY console.labyrinthscout.com/src ./src
COPY console.labyrinthscout.com/public ./public
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /workspace/console.labyrinthscout.com
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV NODE_ENV=production
COPY --from=deps /workspace/console.labyrinthscout.com/node_modules ./node_modules
COPY --from=deps /workspace/core.carinaai.uk/packages/transport /workspace/core.carinaai.uk/packages/transport
COPY --from=build /workspace/console.labyrinthscout.com/dist ./dist
COPY --from=build /workspace/console.labyrinthscout.com/public ./public
EXPOSE 4444
CMD ["node", "dist/server.js"]
