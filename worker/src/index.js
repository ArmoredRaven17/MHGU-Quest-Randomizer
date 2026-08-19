import { rollQuest, rollQuestOnly, rollWeaponOnly, rollChallengeOnly, rollDefaultQuest, defaultFilters, formatForChat, formatQuestOnly, formatWeaponOnly, formatChallengeOnly } from "./randomizer.js";
import { handleLogin, handleCallback, handleLogout } from "./auth.js";
import { handleMe, handleGetFilters, handlePreview, handlePublish, handleCorsPreflight } from "./api.js";
import { handleBingoPublish, handleBingoGet, handleBingoLink, handleBingoRoll, handleBingoSet,
         handleBingoChannelGet, handleBingoChannelPut, handleBingoCorsPreflight } from "./bingo.js";
// Live talisman-bingo sessions. Additive: /live* collides with nothing above, and the
// Durable Object it uses is the first stateful primitive in this Worker. See live.js.
import {
  handleLiveCorsPreflight, handleLiveCreate, handleLiveGet,
  handleLiveDraw, handleLiveEnd, handleLiveDelete, parseLiveSession,
} from "./live.js";

// The web app's already-public data.js — reused as-is rather than bundling a second
// copy of the quest data that could drift out of sync. It's a JS file that assigns
// `window.MHGU_DATA = {...}`, so we pull just the {...} span and JSON.parse it.
const DATA_JS_URL = "https://armoredraven17.github.io/MHGU-Quest-Randomizer/data.js";

function parseDataJs(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Could not locate JSON object in data.js");
  return JSON.parse(text.slice(start, end + 1));
}

// Best-effort in-memory cache for the lifetime of this Worker isolate — isolates can be
// evicted/recycled at any time, so this just reduces repeat fetches on a hot isolate,
// it's not a durable cache.
let cachedData = null;
let cachedAt = 0;
const DATA_TTL_MS = 5 * 60 * 1000;

// A hung/slow fetch here would otherwise stall the whole response — chat bots (Nightbot,
// Moobot) time out their own urlfetch after a few seconds and silently show nothing if we
// take too long, so fail fast and let the caller return a clear "try again" message instead.
const DATA_FETCH_TIMEOUT_MS = 4000;

async function getData() {
  const now = Date.now();
  if (cachedData && now - cachedAt < DATA_TTL_MS) return cachedData;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DATA_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(DATA_JS_URL, { cf: { cacheTtl: 300, cacheEverything: true }, signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch data.js: ${res.status}`);
    const text = await res.text();
    cachedData = parseDataJs(text);
    cachedAt = now;
    return cachedData;
  } finally {
    clearTimeout(timeout);
  }
}

// MHGU Bingo publishes its own trimmed data.js (window.MHGU_BINGO_DATA), carrying a
// dataVersion that feeds the seed fingerprint. The bot reads THAT file rather than the
// randomizer's above, so a card rolled here and the same seed pasted into the app are
// built from byte-identical data — otherwise the two could drift apart and the seed
// would quietly stop reproducing the card.
const BINGO_DATA_JS_URL = "https://armoredraven17.github.io/MHGU-Bingo/data.js";
let cachedBingoData = null;
let cachedBingoAt = 0;

async function getBingoData() {
  const now = Date.now();
  if (cachedBingoData && now - cachedBingoAt < DATA_TTL_MS) return cachedBingoData;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DATA_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(BINGO_DATA_JS_URL, { cf: { cacheTtl: 300, cacheEverything: true }, signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch bingo data.js: ${res.status}`);
    cachedBingoData = parseDataJs(await res.text());
    cachedBingoAt = now;
    return cachedBingoData;
  } finally {
    clearTimeout(timeout);
  }
}

// Explicit no-store on every roll/error response below — each call is meant to be a
// fresh random result, so nothing between us and the calling bot (an intermediate proxy,
// the bot's own urlfetch client) should ever have a reason to serve a cached one instead.
const NO_STORE = { "Cache-Control": "no-store" };

// Twitch silently drops a chat message that's byte-identical to the bot's own immediately
// preceding message (its ~30s anti-spam duplicate filter — no error shown, especially when
// the bot isn't a moderator). This bites hardest on small/static output spaces — e.g.
// "No challenges rolled this time." repeats constantly whenever nothing rolls, so back-to-
// back calls often look like the command silently stopped working. Appending a short random
// run of invisible zero-width characters makes consecutive responses near-certain to differ
// at the byte level (1/256 chance of an accidental repeat) without changing anything visible.
function antiDupeTag() {
  const ZWSP = String.fromCharCode(0x200b); // zero-width space
  const ZWNJ = String.fromCharCode(0x200c); // zero-width non-joiner
  const chars = [ZWSP, ZWNJ];
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function dataUnavailableResponse() {
  return new Response("Could not load quest data right now — try again shortly." + antiDupeTag(), { status: 502, headers: { "Content-Type": "text/plain", ...NO_STORE } });
}

// Resolves a request's saved filters: no ?channel= means the shared default pool
// (rollDefaultQuest-style callers pass null through); a channel present but never
// published returns a sentinel string the caller turns into a friendly message.
const NOT_CONFIGURED = Symbol("not-configured");

async function resolveChannelFilters(url, env) {
  const channelRaw = url.searchParams.get("channel");
  if (!channelRaw) return { channelRaw: null, filters: null };
  const channel = channelRaw.trim().toLowerCase();
  const stored = await env.MHGU_BOT_PROFILES.get(channel);
  if (!stored) return { channelRaw, filters: NOT_CONFIGURED };
  try {
    return { channelRaw, filters: JSON.parse(stored) };
  } catch (e) {
    return { channelRaw, filters: null, corrupted: true };
  }
}

function notConfiguredResponse(channelRaw) {
  return new Response(
    `No filters published yet for channel "${channelRaw}". Visit the settings page, configure filters, and Save.` + antiDupeTag(),
    { status: 200, headers: { "Content-Type": "text/plain", ...NO_STORE } }
  );
}

function corruptedResponse() {
  return new Response("Stored filters are corrupted — please republish." + antiDupeTag(), { status: 500, headers: { "Content-Type": "text/plain", ...NO_STORE } });
}

function textResponse(text) {
  return new Response(text + antiDupeTag(), { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE } });
}

async function handleQuest(url, env) {
  let DATA;
  try { DATA = await getData(); } catch (e) { return dataUnavailableResponse(); }

  const { channelRaw, filters, corrupted } = await resolveChannelFilters(url, env);
  if (corrupted) return corruptedResponse();
  if (filters === NOT_CONFIGURED) return notConfiguredResponse(channelRaw);

  const result = channelRaw ? rollQuest(DATA, filters) : rollDefaultQuest(DATA);
  if (!result) return textResponse("No quests match the current filters.");
  return textResponse(formatForChat(result));
}

async function handleQuestOnly(url, env) {
  let DATA;
  try { DATA = await getData(); } catch (e) { return dataUnavailableResponse(); }

  const { channelRaw, filters, corrupted } = await resolveChannelFilters(url, env);
  if (corrupted) return corruptedResponse();
  if (filters === NOT_CONFIGURED) return notConfiguredResponse(channelRaw);

  const result = rollQuestOnly(DATA, channelRaw ? filters : defaultFilters());
  if (!result) return textResponse("No quests match the current filters.");
  return textResponse(formatQuestOnly(result));
}

async function handleWeaponOnly(url, env) {
  let DATA;
  try { DATA = await getData(); } catch (e) { return dataUnavailableResponse(); }

  const { channelRaw, filters, corrupted } = await resolveChannelFilters(url, env);
  if (corrupted) return corruptedResponse();
  if (filters === NOT_CONFIGURED) return notConfiguredResponse(channelRaw);

  const result = rollWeaponOnly(DATA, channelRaw ? filters : defaultFilters());
  return textResponse(formatWeaponOnly(result));
}

// The invisible-character trick (antiDupeTag) didn't survive whatever sanitizing some
// urlfetch proxies (e.g. StreamElements') apply before posting to chat, so it never
// reached Twitch intact — meaning back-to-back "no challenge" rolls still looked
// byte-identical to Twitch and got silently dropped by its duplicate-message filter.
// This is the dominant case for /challenge-only specifically, since a channel with no
// (or low-chance) challenges configured returns this exact static line most of the time.
// A persistent per-channel call counter lets us alternate between two *visibly* distinct
// phrasings, guaranteeing consecutive calls from the same channel are never identical,
// rather than hoping an invisible/random trick happens to differ and survives untouched.
const NO_CHALLENGE_MESSAGES = [
  "No challenges rolled this time.",
  "No challenges this time — try again!",
];

async function nextTallyParity(env, key) {
  const tallyKey = `__tally__challenge__${key}`;
  let n = 0;
  try {
    const stored = await env.MHGU_BOT_PROFILES.get(tallyKey);
    n = stored ? (parseInt(stored, 10) || 0) : 0;
  } catch (e) {}
  const next = (n + 1) % 1000000;
  try {
    await env.MHGU_BOT_PROFILES.put(tallyKey, String(next));
  } catch (e) {}
  return next % 2;
}

// No getData()/DATA needed at all — challenges live entirely in filters, not the quest
// pool, so this is the only roll endpoint that doesn't depend on data.js being reachable.
async function handleChallengeOnly(url, env) {
  const { channelRaw, filters, corrupted } = await resolveChannelFilters(url, env);
  if (corrupted) return corruptedResponse();
  if (filters === NOT_CONFIGURED) return notConfiguredResponse(channelRaw);

  const result = rollChallengeOnly(channelRaw ? filters : defaultFilters());
  if (!result.challenges.length) {
    const parity = await nextTallyParity(env, channelRaw || "__default__");
    return textResponse(NO_CHALLENGE_MESSAGES[parity]);
  }
  return textResponse(formatChallengeOnly(result));
}

// Required by the durable_objects binding in wrangler.toml — the class must be reachable
// from the entry module, not merely defined somewhere in the bundle.
export { LiveSession } from "./live-do.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (pathname === "/quest" && method === "GET") return handleQuest(url, env);
    if (pathname === "/quest-only" && method === "GET") return handleQuestOnly(url, env);
    if (pathname === "/weapon-only" && method === "GET") return handleWeaponOnly(url, env);
    if (pathname === "/challenge-only" && method === "GET") return handleChallengeOnly(url, env);

    if (pathname === "/auth/login" && method === "GET") return handleLogin(request, env);
    if (pathname === "/auth/callback" && method === "GET") return handleCallback(request, env);
    if (pathname === "/auth/logout" && method === "POST") return handleLogout();

    if ((pathname === "/api/me" || pathname === "/api/filters" || pathname === "/api/publish")
        && method === "OPTIONS") return handleCorsPreflight();

    if (pathname === "/api/me" && method === "GET") return handleMe(request, env);
    if (pathname === "/api/filters" && method === "GET") return handleGetFilters(request, env);
    if (pathname === "/api/preview" && method === "POST") {
      let DATA;
      try {
        DATA = await getData();
      } catch (e) {
        return dataUnavailableResponse();
      }
      return handlePreview(request, env, DATA);
    }
    if (pathname === "/api/publish" && method === "POST") return handlePublish(request, env);

    // MHGU Bingo share codes. Independent of the OAuth routes above — a bingo card has
    // no identity, just a write key minted on first publish. See bingo.js.
    if (pathname === "/bingo-link" && method === "GET") return handleBingoLink(url, env);
    if (pathname === "/bingo-channel") {
      if (method === "OPTIONS") return handleBingoCorsPreflight();
      if (method === "GET") return handleBingoChannelGet(url, env);
      if (method === "POST") return handleBingoChannelPut(request, url, env);
    }
    if (pathname === "/bingo-set" && method === "GET") {
      let BINGO_DATA;
      try {
        BINGO_DATA = await getBingoData();
      } catch (e) {
        return new Response("Bingo data is unavailable right now — try again in a moment.",
          { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE } });
      }
      return handleBingoSet(url, env, BINGO_DATA);
    }
    if (pathname === "/bingo" || pathname.startsWith("/bingo/")) {
      const code = pathname === "/bingo" ? "" : pathname.slice("/bingo/".length).toUpperCase();
      if (code && !/^[0-9A-Z]{6}$/.test(code)) return new Response("Not found", { status: 404 });
      if (method === "OPTIONS") return handleBingoCorsPreflight();
      if (method === "POST") return handleBingoPublish(request, env, code);
      if (method === "GET" && code) return handleBingoGet(env, code);
      // GET /bingo with no code is the chat command: roll a fresh card.
      if (method === "GET") {
        let BINGO_DATA;
        try {
          BINGO_DATA = await getBingoData();
        } catch (e) {
          return new Response("Bingo data is unavailable right now — try again in a moment.",
            { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE } });
        }
        return handleBingoRoll(env, BINGO_DATA);
      }
    }

    // Live talisman-bingo sessions. The session string is validated before a Durable
    // Object is addressed, exactly as /bingo/:code validates its code above.
    if (pathname === "/live" || pathname.startsWith("/live/")) {
      if (method === "OPTIONS") return handleLiveCorsPreflight();
      if (pathname === "/live") {
        if (method === "POST") return handleLiveCreate(request, env);
        return new Response("Not found", { status: 404 });
      }
      const rest = pathname.slice("/live/".length);
      const slash = rest.indexOf("/");
      const raw = slash < 0 ? rest : rest.slice(0, slash);
      const tail = slash < 0 ? "" : rest.slice(slash + 1);
      const id = parseLiveSession(decodeURIComponent(raw));
      if (!id) return new Response("Not found", { status: 404 });
      if (tail === "" && method === "GET") return handleLiveGet(request, env, id);
      if (tail === "" && method === "DELETE") return handleLiveDelete(request, env, id);
      if (tail === "draw" && method === "POST") return handleLiveDraw(request, env, id);
      if (tail === "end" && method === "POST") return handleLiveEnd(request, env, id);
      return new Response("Not found", { status: 404 });
    }

    // Anything else (including /settings.html, /settings.js, /settings.css) falls
    // through to Workers Static Assets automatically via the [assets] binding in
    // wrangler.toml — this handler only needs to cover the dynamic API surface.
    return new Response("Not found", { status: 404 });
  },
};
