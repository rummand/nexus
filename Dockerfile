# Nexus — production image (Railway / any Docker host).
# The app is a Next.js server with a SQLite (libsql) database file. Mount a volume and point
# DATABASE_URL at it (e.g. file:/data/nexus.db) so the graph survives redeploys.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @nexus/web build

FROM base AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 \
    DATABASE_URL=file:/data/nexus.db
COPY --from=build /app /app
RUN mkdir -p /data && chown -R node:node /data /app
USER node
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec next start -p ${PORT:-3000}"]
