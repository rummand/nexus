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
   - `NEXUS_ACCESS_PASSWORD` — optional; when set, every page sits behind one shared password
     *in front of* the per-person sign-in (§5.41). Two doors rather than one: useful on the open
     internet, because an instance behind it cannot be enumerated at all.
   - `NEXUS_DEMO_SIGNIN` — optional. `1` prints the seeded demo credentials on the sign-in page,
     which is what makes a public demo usable; leave it unset on a real deployment. It has no
     effect once the seeded password has been changed.
4. **Networking** → *Generate domain*. Open `https://<domain>/api/health` — the first call runs
   the migrations and seeds the demo workspace, then returns `{"ok":true,...}`. The app then
   redirects `/` to the demo workspace, or to `/signin` first.
5. **Sign in.** Every page is behind a per-person sign-in since rev 76. A freshly seeded instance
   has four people who all share the password `acme-energy` — fine for a demo, and the first thing
   to change on anything real. There is no sign-up page and no password reset by design: an
   administrator writes the row and sets the hash (`hashPassword` in
   `src/lib/auth/password.ts`), and enterprise SSO is the intended answer rather than an email
   service behind a forgotten-password flow.

Redeploys reuse the volume, so boards, entities and versions persist. To start over, delete
`nexus.db*` on the volume (or wipe the volume) and redeploy.

## Deploying a branch you are working on

The GitHub integration above follows one branch. To put the working tree in front of somebody
without changing that, push the branch and then upload it straight to the service:

```bash
railway link                       # once: pick the project, environment and service
railway up --detach                # builds the current directory with the root Dockerfile
railway domain                     # the public URL, if one has not been generated yet
railway logs --deployment          # follow the build
```

`railway up` uploads what is on disk, so commit and push first or the deployed code is not the
code in the branch. Two things to check before deploying a branch onto a service that already
holds data: that the migrations the branch adds are **additive** (a new table or a nullable
column is safe; a dropped or narrowed column is not, and the volume has no backup), and that any
new variable the branch needs is set. `GET /api/health` reports the dialect and confirms the
migrations ran.

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
- People sign in, but everybody who can sign in can do everything: nothing yet reads
  `workspace_members.role` (§5.41). Do not put a workspace in front of people who should only be
  able to read it.
- Real-time collaboration keeps its session in one server's memory (§5.40), so it works when
  everybody talks to the same instance — which is what this deployment is. Scaling to several
  replicas needs the patches carried between them.
- Fonts load from Google Fonts at runtime; the app falls back to system fonts when blocked.

## Closing off a public instance

People sign in as themselves (§5.41), so a deployed instance is not open. A shared password can be
added *in front of* that, which is worth doing on the open internet: it makes the instance opaque
rather than merely locked, so nobody can tell what it is or who has an account.

```
NEXUS_ACCESS_PASSWORD=<something long>
```

Visitors then get a `/login` page and a 30-day cookie. `/api/health` stays open so the platform
health check keeps passing. Unset the variable to remove the gate.
