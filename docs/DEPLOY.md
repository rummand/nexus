# Deploying Nexus (Railway)

Nexus is a single Next.js server plus a database — a SQLite file (libsql) by default, or Postgres
when `DATABASE_URL` says so (see Notes). With SQLite, in production the file
must live on a **persistent volume**; without one every redeploy starts from the seeded demo.

## Railway, step by step

1. **New project → Deploy from GitHub repo** → pick `rummand/nexus` and the branch you want
   (the app builds from the root `Dockerfile`; `railway.json` sets the health check).
2. **Add a volume** to the service (service → *Settings* → *Volumes* → *Add volume*) and mount
   it at `/data`.
3. **Variables** (service → *Variables*):
   - `DATABASE_URL` = `file:/data/nexus.db` (already the image default; set it explicitly so it
     is visible)
   - `PORT` is injected by Railway; the image honours it.
   - `ANTHROPIC_API_KEY` and `NEXUS_MODEL` — optional, and required together. They are the
     *fallback* model: since rev 65 a provider is normally added in the running app under
     **Settings → Models** (§5.31), which also allows OpenAI-compatible and self-hosted endpoints
     and a different model per job. With one of these pairs in place, Compose (§5.17) answers
     requests written in plain English; with neither it falls back to the rule compiler and says
     so in the panel. `NEXUS_MODEL` takes a model id from the provider's own list. There is
     deliberately no default: a board built by a model the operator did not choose is not a good
     surprise.
   - `NEXUS_SECRET_KEY` — set this to a long random value if anybody will enter an API key under
     Settings → Models. It encrypts those keys (AES-256-GCM) at rest. Without it the keys are
     stored as they are and the settings page says so; changing it afterwards makes the stored
     keys unreadable and they must be entered again.
   - `NEXUS_MODEL_BASE_URL` — optional, for an enterprise gateway or proxy in front of the
     Messages API. It is a distinct name on purpose, so the application never inherits an
     `ANTHROPIC_BASE_URL` that belongs to some other tool on the host.
   - `NEXUS_ACCESS_PASSWORD` — optional; when set, every page sits behind a shared password.
4. **Networking** → *Generate domain*. Open `https://<domain>/api/health` — the first call runs
   the migrations and seeds the demo workspace, then returns `{"ok":true,...}`. The app then
   redirects `/` to the demo workspace.

Redeploys reuse the volume, so boards, entities and versions persist. To start over, delete
`nexus.db*` on the volume (or wipe the volume) and redeploy.

## Any Docker host

```bash
docker build -t nexus .
docker run -p 3000:3000 -v nexus-data:/data nexus
```

## Notes

- SQLite is single-instance: WAL mode serves one server process well but does not share a volume
  between replicas. To scale out, point `DATABASE_URL` at Postgres — the app picks the driver from
  the connection string and runs the Postgres migrations in `apps/web/drizzle-pg` on first request.
  On Railway: add a Postgres database to the project and set
  `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the web service (the `/data` volume is then unused).
  TLS is negotiated unless the URL says `sslmode=disable` or `DATABASE_SSL=false` is set;
  `DATABASE_POOL_MAX` sizes the pool (default 10). `GET /api/health` reports which dialect is live.
  Nothing migrates the data across for you — a switch starts from the seed.
- No authentication yet (brief 1): anyone with the URL can edit. Put the service behind Railway's
  private networking, an access proxy or basic auth until auth lands.
- Fonts load from Google Fonts at runtime; the app falls back to system fonts when blocked.

## Closing off a public instance

There is no per-user login yet, so a deployed instance is editable by anyone with the URL. To put
one shared password in front of it, set a variable on the service:

```
NEXUS_ACCESS_PASSWORD=<something long>
```

Visitors then get a `/login` page and a 30-day cookie. `/api/health` stays open so the platform
health check keeps passing. Unset the variable to remove the gate.
