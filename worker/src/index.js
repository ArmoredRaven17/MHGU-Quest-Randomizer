import { rollQuest, formatForChat } from "./randomizer.js";

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

async function handleQuest() {
  let DATA;
  try {
    DATA = await getData();
  } catch (e) {
    return new Response("Could not load quest data right now — try again shortly.", { status: 502, headers: { "Content-Type": "text/plain" } });
  }

  const result = rollQuest(DATA);
  if (!result) {
    return new Response("No quests match the current pool.", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response(formatForChat(result), { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/quest" && request.method === "GET") {
      return handleQuest();
    }
    return new Response("Not found", { status: 404 });
  },
};
