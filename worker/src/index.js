import { rollQuest, rollQuestOnly, rollWeaponOnly, rollChallengeOnly, rollDefaultQuest, defaultFilters, formatForChat, formatQuestOnly, formatWeaponOnly, formatChallengeOnly } from "./randomizer.js";
import { handleLogin, handleCallback, handleLogout } from "./auth.js";
import { handleMe, handleGetFilters, handlePreview, handlePublish, handleCorsPreflight } from "./api.js";

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

// Explicit no-store on every roll/error response below — each call is meant to be a
// fresh random result, so nothing between us and the calling bot (an intermediate proxy,
// the bot's own urlfetch client) should ever have a reason to serve a cached one instead.
const NO_STORE = { "Cache-Control": "no-store" };

function dataUnavailableResponse() {
  return new Response("Could not load quest data right now — try again shortly.", { status: 502, headers: { "Content-Type": "text/plain", ...NO_STORE } });
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
    `No filters published yet for channel "${channelRaw}". Visit the settings page, configure filters, and Save.`,
    { status: 200, headers: { "Content-Type": "text/plain", ...NO_STORE } }
  );
}

function corruptedResponse() {
  return new Response("Stored filters are corrupted — please republish.", { status: 500, headers: { "Content-Type": "text/plain", ...NO_STORE } });
}

function textResponse(text) {
  return new Response(text, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE } });
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

// No getData()/DATA needed at all — challenges live entirely in filters, not the quest
// pool, so this is the only roll endpoint that doesn't depend on data.js being reachable.
async function handleChallengeOnly(url, env) {
  const { channelRaw, filters, corrupted } = await resolveChannelFilters(url, env);
  if (corrupted) return corruptedResponse();
  if (filters === NOT_CONFIGURED) return notConfiguredResponse(channelRaw);

  const result = rollChallengeOnly(channelRaw ? filters : defaultFilters());
  return textResponse(formatChallengeOnly(result));
}

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

    // Anything else (including /settings.html, /settings.js, /settings.css) falls
    // through to Workers Static Assets automatically via the [assets] binding in
    // wrangler.toml — this handler only needs to cover the dynamic API surface.
    return new Response("Not found", { status: 404 });
  },
};
