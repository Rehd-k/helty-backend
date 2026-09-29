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

# Tell pnpm to allow Prisma and NestJS to run their setup scripts
RUN pnpm config set dangerouslyAllowAllBuilds true \
  && pnpm install --frozen-lockfile

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

# Increase Node.js heap from the default ~2 GB limit.
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Keep Prisma available for migrations and one-off commands in Coolify.
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/views ./views

RUN mkdir -p /app/uploads \
  && chown -R nestjs:nestjs /app

USER nestjs

EXPOSE 3000

VOLUME ["/app/uploads"]

# Start the compiled NestJS application directly.
CMD ["node", "dist/main.js"]