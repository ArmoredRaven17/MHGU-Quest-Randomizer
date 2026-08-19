# The MHGU app ecosystem: shared Worker, Twitch OAuth, and how to add an app

Written for whoever picks this up next — human or agent — with no other context. It describes
what this Worker actually is, the auth model every app shares, and the checklist for wiring a new
app in.

**Start here:** this is not the Quest Randomizer's backend. It is the **shared backend for every
MHGU app**, which happens to live inside the Quest Randomizer's repo for historical reasons. That
mismatch between the name, the location and the job is the single most misleading thing about the
codebase, and it is a known debt (see [Known debts](#known-debts)).

Deployed at **`https://mhgu-bot-api.raven-mhgu.workers.dev`**, source in `MHGU Quest Randomizer/worker/`.

---

## Who uses it

| App | Repo | What it uses the Worker for |
|---|---|---|
| MHGU Quest Randomizer | `MHGU Quest Randomizer` | `/quest*`, `/weapon-only`, `/challenge-only` — plain-text chat-bot endpoints; `/api/*` for per-channel filter profiles |
| MHGU Bingo | `MHGU Bingo` | `/bingo*` — share codes for finished cards, plus per-channel "current card" |
| MHGU Talisman Bingo | `mhgu-talisman-bingo` | `/live*` — live Gamemaster sessions (draw counter only) |
| Twitch chat bots | Nightbot / Moobot | The plain-text endpoints above, via `$(urlfetch …)` |

Everything else on `armoredraven17.github.io` is currently static-only and talks to nothing.

**Consequence worth internalising:** a bad deploy here takes out chat commands for a live stream,
not just one app's feature. Deploy off-stream. Deploys are atomic and fail closed, and
`wrangler rollback` exists, but the coupling is real.

---

## Twitch OAuth: identity only

The single most important thing to understand, because it is smaller than it looks.

**No scopes are requested.** `auth.js` sends no `scope` parameter at all, so this is a bare
"who are you" login. The app cannot read chat, cannot see subs, cannot post, cannot touch channel
points. It learns a **Twitch login name** and nothing else.

The Twitch access token is used once to call `helix/users`, then **discarded**. It is never stored.

```
/auth/login?return=<app>
        │  state = crypto.randomUUID() in an HttpOnly cookie
        ▼
id.twitch.tv/oauth2/authorize   (no scope)
        ▼
/auth/callback
        │  exchange code -> access token -> GET helix/users -> { login }
        │  access token discarded here
        ▼
redirect to RETURN_DESTINATIONS[<app>] + "#mhgu_bot_token=<session>"
```

### The fragment handoff, and why

The session is returned in the **URL fragment**, not a query string and not a cookie.

- A fragment is **never sent to a server** and never appears in a `Referer` header.
- Cookies do not work here: the apps are on `armoredraven17.github.io` and the Worker is on
  `workers.dev`, a different origin. Safari's ITP unreliably blocks or expires cross-site cookies,
  so a cookie-based session breaks for some users with no diagnosable symptom.

The client reads the fragment, moves the value into `localStorage`, and clears the hash. Every
subsequent request sends `Authorization: Bearer <session>`. See `captureTokenFromHash()` in any
client app for the ~6 lines involved.

### The session itself

`session.js` — a stateless **HMAC-SHA256 signed** `{login, exp}` blob, base64url, built entirely on
`crypto.subtle` with **zero dependencies**. 7-day TTL.

- Verified server-side on every privileged request.
- Decoded client-side for display only — nothing trusts the client's reading of it.
- Because it is stateless, **any Worker holding `SESSION_SECRET` can verify it**. That is what
  makes a split into multiple Workers technically possible and organisationally unwise (below).

### `RETURN_DESTINATIONS` — the allowlist

```js
const RETURN_DESTINATIONS = {
  main:     MAIN_SITE_URL,       // /MHGU-Quest-Randomizer/
  bingo:    BINGO_APP_URL,       // /MHGU-Bingo/
  talisman: TALISMAN_APP_URL,    // /mhgu-talisman-bingo/
};
```

The **key** is what a caller may ask for; the **value** is a constant defined in `auth.js`. The
redirect target is always a hardcoded literal, never the query value. Never widen this into
"redirect to whatever URL was passed" — that is an open redirect and the whole point of the shape.

⚠️ **Paths are case-sensitive.** GitHub Pages serves `/MHGU-Bingo/` and `/mhgu-talisman-bingo/` as
distinct paths. The talisman app is lowercase-hyphenated unlike its older siblings; that is not a
style inconsistency to tidy away.

---

## Why ONE Worker and not one per app

This gets asked every time an app is added. The short answer: **auth wants to be central**, so
splitting collapses into "one auth Worker plus N feature Workers", which is more moving parts for
the same coupling.

Concretely, a second Worker would need:

1. **Its own registered Twitch redirect URI** in the Twitch dev console — a manual step outside
   any repo, and easy to forget.
2. **A duplicate of `SESSION_SECRET`.** Sessions are stateless so this *works*, but if the secret
   is ever rotated and one copy is missed, that app silently rejects every login. Silent auth
   failure with no error anywhere is the worst class of bug to inherit.
3. **A `RETURN_DESTINATIONS` entry here anyway**, unless it also duplicates the whole OAuth flow.

So isolation is never total, and the price is a duplicated secret.

**What sharing actually costs** is *deploy coupling* — iterating on one app's endpoints redeploys
the Worker every app depends on. Runtime isolation is decent: routes are independent, the Durable
Object is reachable only from `/live*`, and quota exhaustion in one feature does not take the
others down.

**The right fix is not splitting the Worker — it is moving it out of the Quest Randomizer repo**
into its own (`mhgu-api` or similar), so adding a fifth app is routine rather than "cramming more
into the Randomizer". Tracked under [Known debts](#known-debts).

---

## Storage: KV by default, Durable Objects when correctness demands it

| Binding | Type | Used by | Why |
|---|---|---|---|
| `MHGU_BOT_PROFILES` | KV | `/api/*` | Per-channel filter profiles. Written rarely, read rarely, staleness harmless. |
| `MHGU_BINGO_CARDS` | KV | `/bingo*` | Share codes, 30-day TTL; channel entries 365-day. Write-once-read-many. |
| `LIVE_SESSIONS` | **Durable Object** | `/live*` | The draw counter. See below. |

**KV is the default and usually right.** It is cheap, simple, and eventual consistency does not
matter for "what filters does this channel use".

**The live draw counter could not use KV**, for two reasons, the first decisive:

1. **KV has no compare-and-swap.** The load-bearing guarantee is that the draw number *never goes
   backwards* — hundreds of viewers cannot be un-shown a talisman they have already marked. On KV,
   two racing writes are last-write-wins, and a stale reader computing `n+1` can genuinely *lower*
   the counter. A Durable Object is single-threaded, so `n = Math.max(n, requested)` is atomic by
   construction rather than by hope.
2. KV writes take up to ~60s to propagate and its edge cache has a 60s minimum TTL. The baseline
   this feature has to beat is "the Gamemaster reads the number out loud", and a minute is worse.

`LIVE_SESSIONS` is the **first stateful primitive** in this Worker. It uses the **SQLite** backend
(`new_sqlite_classes` in the migration), which is what makes it available on the Workers free plan —
`new_classes`, the older KV-backed form, is rejected there.

⚠️ **Migrations are close to one-way.** `wrangler rollback` restores code but does *not* unregister
a Durable Object class. An orphaned class with no traffic is harmless, but removing one properly
needs a follow-up `deleted_classes` migration. Choose class names deliberately.

---

## The design rule that matters most

**Never mirror a client generator on the server.**

`bingo-gen.js` is a hand-maintained, byte-faithful copy of MHGU Bingo's client card generator, so
that a chat-rolled seed reproduces in the app. `git log -- worker/` is a wall of *"Mirror the X into
the bingo generator"* commits. It is the largest ongoing maintenance cost in this codebase.

Talisman Bingo deliberately avoids it. Its `drawAt(n)` is a pure function of `(session string, n)`,
so the server stores and transmits **one integer** — the draw number — and every client turns that
into the identical talisman locally. The server imports none of the app's data or logic and never
sees a talisman, a card, a square or a mark.

When adding a feature, the question to ask is: *can the client derive this from something small?*
If yes, send the small thing.

---

## Adding a new app: checklist

1. **`auth.js`** — add a `<NAME>_APP_URL` constant and one `RETURN_DESTINATIONS` entry. Match the
   GitHub Pages path casing exactly.
2. **Routes** — new namespace under its own prefix. Check it collides with nothing in `index.js`
   *and* nothing in `worker/public/` (Static Assets serves first and falls through).
3. **CORS** — probably nothing to do. All apps share the origin `https://armoredraven17.github.io`,
   which is already the single hardcoded allowed origin. This is the same fact that forces every app
   to namespace its `localStorage` keys.
4. **Validation** — allowlist, never blocklist. See `bingo.js`'s `cleanIcon`/`cleanTint` and
   `live.js`'s session regex. Validate *shape*, not semantics: re-encoding client knowledge on the
   server is how you get a second `bingo-gen.js`.
5. **Storage** — KV unless you need atomicity or strong consistency. Give every KV write a TTL.
6. **Client** — reuse `captureTokenFromHash()`; store the token under a **namespaced** key
   (`mhgu-<app>-token`); send it as `Authorization: Bearer`.
7. **Deploy** — `wrangler deploy --dry-run` first, then deploy off-stream, then smoke the *entire*
   pre-existing surface before testing your new routes.

---

## Deploying

```bash
cd "MHGU Quest Randomizer/worker"
npx wrangler deploy --dry-run     # validates bindings and migrations, ships nothing
npx wrangler deploy
npx wrangler deployments list     # note the version id before you change anything
npx wrangler rollback <version-id>
npx wrangler tail                 # live logs, useful during a first stream
```

There is **no CI** for the Worker. It is hand-deployed. (Several of the static apps *do* have
`.github/workflows/deploy-pages.yml`; the Worker does not.)

Secrets are set with `wrangler secret put`, never committed: `TWITCH_CLIENT_SECRET`, `SESSION_SECRET`.
`worker/.dev.vars` holds local-dev copies and is gitignored. **The local and production
`SESSION_SECRET` differ** — verified, and correct. A token minted locally will 401 against
production, so the authenticated path cannot be smoke-tested from a script; it needs a real Twitch
login in a browser.

`TWITCH_CLIENT_ID` is public and lives in `wrangler.toml` under `[vars]`.

---

## Known debts

| Debt | Why it matters |
|---|---|
| **The Worker lives in the Quest Randomizer repo** and is named `mhgu-bot-api` | It is the shared backend for three apps. The name and location say otherwise, so every addition feels like cramming. **Fix: extract to its own repo.** Do it as its own change, with nothing else in flight, since it touches secrets and deploy paths. |
| **`bingo-gen.js` mirrors a client generator** | Every generator change is two edits plus a parity check. Do not extend this pattern. |
| **The Worker fetches app data over HTTPS at runtime** | `index.js` pulls `data.js` from the deployed GitHub Pages sites and regexes out the JSON, with a 5-minute isolate cache and a 4s abort (Nightbot times out silently). It means a Pages outage degrades chat commands. |
| **CORS is a single hardcoded origin** | Correct for production, but local dev against `localhost` fails preflight. Test against the deployed site, or add a dev-only origin temporarily. |
| **No CI for the Worker** | Hand-deployed. Easy to forget after editing. |

---

## History

- Worker created for the Quest Randomizer's Nightbot commands.
- Twitch OAuth added for per-channel filter profiles (`/api/*`).
- MHGU Bingo share codes added (`/bingo*`) — first sign this was becoming a shared backend.
- **2026-08-19** — Talisman Bingo live sessions added (`/live*`), introducing the first Durable
  Object. Deployed as version `b6449baf-a00d-48e0-aabd-0841ad54bb90`; previous version
  `19a962b8-c69d-44b6-8dc2-dea4cf67d99d`.
