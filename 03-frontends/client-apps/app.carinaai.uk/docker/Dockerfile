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

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4100
ENV HOSTNAME=0.0.0.0
ENV CARINA_HOME=/app/data
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini python3 python3-pip ffmpeg \
  && pip3 install --break-system-packages faster-whisper \
  && python3 -c "from faster_whisper import WhisperModel; print('faster-whisper ok')" \
  && mkdir -p /app/data/whisper-models \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 4100
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
