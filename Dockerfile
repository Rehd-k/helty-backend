# syntax=docker/dockerfile:1

# ── Build ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm exec prisma generate \
  && pnpm run build

# ── Runtime ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && groupadd --system --gid 1001 nestjs \
  && useradd --system --uid 1001 --gid nestjs nestjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Keep prisma + ts-node available for migrate deploy and one-off seeds in Coolify.
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/views ./views
COPY docker/entrypoint.sh /app/docker/entrypoint.sh

RUN chmod +x /app/docker/entrypoint.sh \
  && mkdir -p /app/uploads \
  && chown -R nestjs:nestjs /app

USER nestjs

EXPOSE 3000

VOLUME ["/app/uploads"]

ENTRYPOINT ["/app/docker/entrypoint.sh"]
