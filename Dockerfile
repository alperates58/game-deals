# Multi-stage production-grade Dockerfile
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat postgresql16-client

# Install dependencies (include devDependencies needed for build)
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --include=dev

# Build Next.js application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build_user:build_placeholder@127.0.0.1:5432/build_db?schema=public"
ENV SESSION_SECRET="build_time_placeholder_secret_minimum_64_characters_long_for_nextjs_build_phase"
RUN npx prisma generate
RUN npm run build

# Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create protected server-side backups and public directory
RUN mkdir -p /app/backups /app/public && chown -R nextjs:nodejs /app/backups /app/public

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/next.config.* ./
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/auto-seed.js && npm start"]
