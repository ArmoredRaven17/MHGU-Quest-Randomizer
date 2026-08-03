import { rollQuest, rollDefaultQuest, formatForChat } from "./randomizer.js";
import { handleLogin, handleCallback, handleLogout } from "./auth.js";
import { handleMe, handleGetFilters, handlePreview, handlePublish } from "./api.js";

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

async function getData() {
  const now = Date.now();
  if (cachedData && now - cachedAt < DATA_TTL_MS) return cachedData;
  const res = await fetch(DATA_JS_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw new Error(`Failed to fetch data.js: ${res.status}`);
  const text = await res.text();
  cachedData = parseDataJs(text);
  cachedAt = now;
  return cachedData;
}

async function handleQuest(url, env) {
  let DATA;
  try {
    DATA = await getData();
  } catch (e) {
    return new Response("Could not load quest data right now — try again shortly.", { status: 502, headers: { "Content-Type": "text/plain" } });
  }

  const channelRaw = url.searchParams.get("channel");
  let result;
  if (!channelRaw) {
    result = rollDefaultQuest(DATA);
  } else {
    const channel = channelRaw.trim().toLowerCase();
    const stored = await env.MHGU_BOT_PROFILES.get(channel);
    if (!stored) {
      return new Response(
        `No filters published yet for channel "${channelRaw}". Visit the settings page, configure filters, and Save.`,
        { status: 200, headers: { "Content-Type": "text/plain" } }
      );
    }
    let filters;
    try {
      filters = JSON.parse(stored);
    } catch (e) {
      return new Response("Stored filters are corrupted — please republish.", { status: 500, headers: { "Content-Type": "text/plain" } });
    }
    result = rollQuest(DATA, filters);
  }

  if (!result) {
    return new Response("No quests match the current filters.", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response(formatForChat(result), { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (pathname === "/quest" && method === "GET") return handleQuest(url, env);

    if (pathname === "/auth/login" && method === "GET") return handleLogin(request, env);
    if (pathname === "/auth/callback" && method === "GET") return handleCallback(request, env);
    if (pathname === "/auth/logout" && method === "POST") return handleLogout();

    if (pathname === "/api/me" && method === "GET") return handleMe(request, env);
    if (pathname === "/api/filters" && method === "GET") return handleGetFilters(request, env);
    if (pathname === "/api/preview" && method === "POST") {
      let DATA;
      try {
        DATA = await getData();
      } catch (e) {
        return new Response("Could not load quest data right now — try again shortly.", { status: 502, headers: { "Content-Type": "text/plain" } });
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
