// HTTP surface for live MHGU Talisman Bingo sessions. See live-do.js for why the state
// lives in a Durable Object and what it deliberately does not store.
//
// The Gamemaster draws and POSTs the new draw number; viewers poll for it. Only an integer
// crosses the wire — every client turns it into the identical talisman locally.
import { verifySessionCookie, getCookie } from "./session.js";
import { SESSION_COOKIE_NAME, MAIN_SITE_ORIGIN, TALISMAN_APP_URL } from "./auth.js";

// This payload is one short seed string. bingo.js allows 96 KB because it uploads a whole
// 10x10 card; there is nothing here that could legitimately approach 1 KB.
const MAX_BODY_BYTES = 1024;

// The blackout median is ~1,060 draws (CLAUDE.md, Pacing), so 10,000 is generous headroom.
// The +100 window is the one that matters: it stops a fat-fingered or hostile value
// rocketing the counter and ending a live game for everyone watching.
const MAX_N = 10000;
const MAX_N_JUMP = 100;

// A session string, and ONLY a session string.
//
// THE HYPHEN COUNT IS THE POINT. A session has exactly three hyphens
// (MHGU-5F-N4P3S1R2C3-EYBKVK); a full card seed has five, because it carries the player
// token and fingerprint too (…-EYBKVK-DCK0-HMGF). This pattern is anchored, so it
// structurally rejects that tail — and it must, because a Gamemaster who pasted their FULL
// seed here would otherwise publish their own board to every viewer in the session.
//
// It validates shape, not semantics: no enumerating which pool letters are legal or which
// grid sizes exist. Doing that would be a second, hand-maintained copy of client knowledge
// living on the server — a miniature of the bingo-gen.js problem. The server never
// interprets this string; it only stores and echoes it.
const SESSION_RE = /^MHGU-(?:[3-9]|10)[FN]-(?:[NPSRC][1-9]){1,5}-[0-9A-Z]{6}$/;
const MAX_SESSION_LEN = 40;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": MAIN_SITE_ORIGIN,
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

export function handleLiveCorsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": MAIN_SITE_ORIGIN,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// Same shape as api.js's requireSession: bearer token or same-origin cookie, both just a
// signed string. The talisman app is a different origin, so it uses the bearer path.
async function requireSession(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : getCookie(request, SESSION_COOKIE_NAME);
  return verifySessionCookie(token, env.SESSION_SECRET);
}

async function readJson(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { error: "too_large" };
  try {
    return { value: JSON.parse(raw || "{}") };
  } catch (e) {
    return { error: "invalid_json" };
  }
}

const cleanSession = (v) => {
  const s = String(v || "").trim().toUpperCase();
  return s.length <= MAX_SESSION_LEN && SESSION_RE.test(s) ? s : null;
};

// A channel's current session, so chat can answer "how do I join?" without anyone reading a
// 25-character seed aloud. Reuses MHGU_BINGO_CARDS with a `live:` prefix rather than adding a
// binding: it collides with neither that namespace's 6-char card codes nor its `ch:` keys.
//
// KV is fine HERE and wrong for the counter. This is a pointer written once when a session
// starts, so up to ~60s of propagation lag only means a viewer asking within the first minute
// gets the previous answer. The draw number could not tolerate that, which is why it lives in
// a Durable Object instead.
const LINK_TTL_SECONDS = 24 * 3600;
const channelKey = (raw) => {
  const c = String(raw || "").trim().toLowerCase().replace(/^#/, "");
  return /^[a-z0-9_]{1,25}$/.test(c) ? "live:ch:" + c : null;
};

const stub = (env, session) =>
  env.LIVE_SESSIONS.get(env.LIVE_SESSIONS.idFromName("live:" + session));

// ── Read deduplication ───────────────────────────────────────────────────────
// Every viewer polls this endpoint every few seconds, so the read path has to survive an
// audience rather than a handful of friends.
//
// Cache-Control is NOT the answer: Cloudflare's edge cache is a no-op on *.workers.dev,
// which is where this Worker is deployed. So dedupe inside the isolate instead — the same
// trick getData()/cachedData already uses in index.js.
//
// The important detail is that this caches the in-flight PROMISE, not just the settled
// value. Two hundred pollers arriving in the same colo within the same 1.5s therefore
// produce ONE Durable Object call, not two hundred. Read load against the object stays
// flat at roughly (live isolates / 1.5s) whether five people are watching or five thousand.
const READ_TTL_MS = 1500;
const STALE_GRACE_MS = 30000;
const CACHE_MAX = 50;
const readCache = new Map();

function cacheGet(key) {
  const hit = readCache.get(key);
  if (hit && Date.now() - hit.at < READ_TTL_MS) return hit;
  return null;
}

function cachePut(key, entry) {
  // Bounded so a caller requesting random session strings cannot grow isolate memory.
  if (readCache.size >= CACHE_MAX) {
    const oldest = readCache.keys().next().value;
    if (oldest !== undefined) readCache.delete(oldest);
  }
  readCache.set(key, entry);
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /live  { session } — claim a session as its Gamemaster.
export async function handleLiveCreate(request, env) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: "not_logged_in" }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.error === "too_large" ? 413 : 400);

  const id = cleanSession(body.value && body.value.session);
  if (!id) return json({ error: "invalid_session" }, 400);

  const res = await stub(env, id).claim({ session: id, owner: session.login });
  if (res.error === "already_claimed") return json({ error: "already_claimed" }, 409);
  // Point the owner's channel at this session so !talisman can answer. Best-effort: a failed
  // write costs a chat command, not the game.
  const ck = channelKey(session.login);
  if (ck) {
    try {
      await env.MHGU_BINGO_CARDS.put(ck, id, { expirationTtl: LINK_TTL_SECONDS });
    } catch (e) {}
  }
  readCache.delete(id);
  return json({ ...res, session: id }, 201);
}

// GET /live/:session — public. This is the one viewers poll.
export async function handleLiveGet(request, env, id) {
  const cached = cacheGet(id);
  let state;
  if (cached) {
    state = await cached.promise.catch(() => cached.last);
  } else {
    const entry = { at: Date.now(), last: null, promise: null };
    entry.promise = stub(env, id).read().then((v) => { entry.last = v; return v; });
    cachePut(id, entry);
    try {
      state = await entry.promise;
    } catch (e) {
      // Serve the last known value rather than failing a whole audience over one blip.
      const prev = readCache.get(id);
      if (prev && prev.last && Date.now() - prev.at < STALE_GRACE_MS) {
        return json(prev.last, 200, { "X-Live-Stale": "1" });
      }
      readCache.delete(id);
      return json({ error: "unavailable" }, 503);
    }
  }
  if (!state) return json({ error: "not_found" }, 404);

  // A weak ETag on (n, ended) means a poller that is already up to date gets a 304 with no
  // body — the common case once a session is running and nobody has drawn for a while.
  const etag = 'W/"' + state.n + "-" + (state.ended ? 1 : 0) + '"';
  if ((request.headers.get("If-None-Match") || "") === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Access-Control-Allow-Origin": MAIN_SITE_ORIGIN },
    });
  }
  // max-age=2 is a guard against a runaway client loop, not a CDN instruction. It is
  // deliberately not the no-store used elsewhere in this Worker: two seconds is far inside
  // the stream delay a viewer is already watching through.
  return json(state, 200, { ETag: etag, "Cache-Control": "public, max-age=2" });
}

// POST /live/:session/draw  { n } — owner only. `n` is a target; see LiveSession.draw.
export async function handleLiveDraw(request, env, id) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: "not_logged_in" }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.error === "too_large" ? 413 : 400);

  const n = body.value && body.value.n;
  if (!Number.isInteger(n) || n < 1 || n > MAX_N) return json({ error: "invalid_n" }, 400);

  const current = await stub(env, id).read();
  if (!current) return json({ error: "not_found" }, 404);
  if (n > current.n + MAX_N_JUMP) return json({ error: "invalid_n" }, 400);

  const res = await stub(env, id).draw({ owner: session.login, n });
  if (res.error === "forbidden") return json({ error: "forbidden" }, 403);
  if (res.error === "not_found") return json({ error: "not_found" }, 404);
  if (res.error === "ended") return json({ error: "ended" }, 409);
  if (res.error === "too_fast") return json({ error: "too_fast" }, 429);
  readCache.delete(id);
  return json(res);
}

export async function handleLiveEnd(request, env, id) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: "not_logged_in" }, 401);
  const res = await stub(env, id).end({ owner: session.login });
  if (res.error === "forbidden") return json({ error: "forbidden" }, 403);
  if (res.error === "not_found") return json({ error: "not_found" }, 404);
  readCache.delete(id);
  return json(res);
}

export async function handleLiveDelete(request, env, id) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: "not_logged_in" }, 401);
  const res = await stub(env, id).destroy({ owner: session.login });
  if (res.error === "forbidden") return json({ error: "forbidden" }, 403);
  if (res.error === "not_found") return json({ error: "not_found" }, 404);
  readCache.delete(id);
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": MAIN_SITE_ORIGIN },
  });
}

// GET /live-link?channel=NAME — plain text for a chat bot, mirroring handleBingoLink.
// Returns a joinable URL, because a 25-character seed is not something anyone should have to
// read out or retype.
export async function handleLiveLink(url, env) {
  const text = (body, status = 200) => new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
  const raw = url.searchParams.get("channel");
  if (!raw) return text("This command needs a channel — check it passes ?channel= (Nightbot: $(channel)).");
  const ck = channelKey(raw);
  if (!ck) return text("That doesn't look like a Twitch channel name.");
  let session = null;
  try { session = await env.MHGU_BINGO_CARDS.get(ck); } catch (e) {}
  if (!session) return text("No live talisman bingo session right now — ask the streamer to start one.");
  return text("Join the talisman bingo: " + TALISMAN_APP_URL + "?session=" + encodeURIComponent(session)
    + " — you get your own card and it follows the draws automatically.");
}

// Shared by the router so an invalid session string is rejected before a Durable Object is
// ever addressed — mirroring the /bingo/:code check in index.js.
export const parseLiveSession = cleanSession;
