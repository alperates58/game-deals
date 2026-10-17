# Multi-stage production-grade Dockerfile (Optimized for fast Coolify redeploys)
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat postgresql16-client
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Install dependencies & generate Prisma Client (Cached unless package.json or schema.prisma changes)
FROM base AS deps
WORKDIR /app
ENV DATABASE_URL="postgresql://build_user:build_placeholder@127.0.0.1:5432/build_db?schema=public"
COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --include=dev && ./node_modules/.bin/prisma generate

# 2. Build Next.js application (Inherits node_modules directly from deps with zero copy overhead)
FROM deps AS builder
WORKDIR /app
ENV DATABASE_URL="postgresql://build_user:build_placeholder@127.0.0.1:5432/build_db?schema=public"
ENV SESSION_SECRET="build_time_placeholder_secret_minimum_64_characters_long_for_nextjs_build_phase"
COPY . .
RUN npm run build

# 3. Production runner (Ordered from least-frequently changed to most-frequently changed)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/backups /app/public && \
    chown -R nextjs:nodejs /app/backups /app/public

# Cached across all code-only deploys because it comes from 'deps' BEFORE '.next'
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs package.json ./package.json
COPY --chown=nextjs:nodejs next.config.* ./
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chown=nextjs:nodejs scripts ./scripts
COPY --chown=nextjs:nodejs public ./public
COPY --chown=nextjs:nodejs src ./src
COPY --chown=nextjs:nodejs tsconfig.json ./tsconfig.json

# Only this lightweight layer updates on UI/code changes
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=6 \
  CMD sh -c "if [ \"$PORT\" = \"3000\" ] && [ \"$NODE_ENV\" = \"production\" ]; then wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 0; else exit 0; fi"

CMD ["sh", "-c", "(./node_modules/.bin/prisma migrate deploy || ./node_modules/.bin/prisma db push --accept-data-loss || true) && node scripts/auto-seed.js && exec ./node_modules/.bin/next start"]

