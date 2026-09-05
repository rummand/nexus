# Deploying Nexus (Railway)

Nexus is a single Next.js server plus a SQLite database file (libsql). In production the file
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
   - `ANTHROPIC_API_KEY` and `NEXUS_MODEL` — optional, and required together. With both set,
     Compose (§5.17) answers requests written in plain English; with either missing it falls back
     to the rule compiler and says so in the panel. `NEXUS_MODEL` takes a model id from the
     provider's own list. There is deliberately no default: a board built by a model the operator
     did not choose is not a good surprise.
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

- Single instance only: SQLite in WAL mode serves one server process well but does not share a
  volume between replicas. Scaling out means moving `DATABASE_URL` to Postgres (Drizzle keeps
  the SQL portable; that is the SaaS target in `docs/BRIEF.md` §7).
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
