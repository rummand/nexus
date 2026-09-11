# Nexus — production image (Railway / any Docker host).
#
# The app is a Next.js server with a SQLite (libsql) database file. Mount a volume and point
# DATABASE_URL at it (e.g. file:/data/nexus.db) so the graph survives redeploys.
#
# The shape of this file is about deploy time (§5.80). It used to have two stages and copy the
# whole built workspace into the runtime — every devDependency, the TypeScript compiler,
# Playwright, the test runner and the sources — which is about 1.4 GB that the host pays for
# twice on every deploy, once pushing and once pulling. Three changes:
#
#   1. Dependencies are installed in a stage of their own, so a source-only change never
#      re-resolves them.
#   2. The install and the Next build read from BuildKit caches, so an unchanged lockfile costs
#      nothing and an incremental build reuses the compiler's own cache.
#   3. The runtime copies *only* `.next/standalone`, the traced tree Next emits, which runs on
#      plain node with no package manager and no devDependencies.
#
# On Railway the cache mounts only persist when their id is scoped to the service — change
# `id=nexus-pnpm` to `id=s/<service-id>-pnpm` (and the same for the Next cache) in the service's
# settings to get that; without it the builds are still correct, just colder.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# ---- dependencies -------------------------------------------------------------------------
# Only the manifests, so this layer is reused for every change that is not a dependency change.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
# The knowledge base is a workspace package the app depends on; without its manifest here the
# install produces no link for it and the build fails on the import.
COPY packages/ea-knowledge/package.json packages/ea-knowledge/package.json
# The cache id carries Railway's `s/<service id>` prefix. Their builder rejects the whole
# Dockerfile without it — "missing the cacheKey prefix from its id" — which is how rev 119 broke
# every deploy from 12:51 on 11 Sep while building perfectly everywhere else. The prefix is just
# a cache namespace, so `docker build` elsewhere is unaffected.
RUN --mount=type=cache,id=s/424031e8-c3f8-4825-a390-f15708ba1e49-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build --------------------------------------------------------------------------------
FROM deps AS build
COPY . .
# Next's own cache survives between builds here, which is the difference between a cold compile
# and an incremental one. It lives under .next/ and is not part of what the runtime copies.
RUN --mount=type=cache,id=s/424031e8-c3f8-4825-a390-f15708ba1e49-next,target=/app/apps/web/.next/cache \
    pnpm --filter @nexus/web build

# ---- runtime ------------------------------------------------------------------------------
# A clean node image: the standalone tree carries the dependencies it actually needs, and the
# server starts with `node server.js`, so there is no package manager here at all.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=file:/data/nexus.db \
    EA_CORPUS_DIR=/app/packages/ea-knowledge/corpus
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# /data is chowned here for the no-volume case; the entrypoint redoes it at runtime because a
# mounted volume arrives root-owned and masks this.
RUN mkdir -p /data && chown -R node:node /data /app && chmod +x /usr/local/bin/docker-entrypoint.sh
WORKDIR /app/apps/web
EXPOSE 3000
# Starts as root only to fix the volume's ownership, then drops to `node`.
CMD ["/usr/local/bin/docker-entrypoint.sh"]
