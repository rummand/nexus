#!/bin/sh
# A mounted volume (Railway, Fly, plain Docker) arrives owned by root and masks any ownership
# the image set at build time, so the SQLite file cannot be created by an unprivileged app.
# Fix the mount point as root at startup, then drop to `node` to run the server.
set -e

DATA_DIR=$(node -e 'const u=process.env.DATABASE_URL||"file:/data/nexus.db";const p=u.startsWith("file:")?u.slice(5):"/data/nexus.db";process.stdout.write(require("path").dirname(p))')

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec su node -s /bin/sh -c 'exec pnpm exec next start -p ${PORT:-3000}'
fi

exec pnpm exec next start -p "${PORT:-3000}"
