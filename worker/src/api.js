import { verifySessionCookie, getCookie } from "./session.js";
import { SESSION_COOKIE_NAME } from "./auth.js";
import { rollQuest, formatForChat } from "./randomizer.js";

async function requireSession(request, env) {
  const cookie = getCookie(request, SESSION_COOKIE_NAME);
  return verifySessionCookie(cookie, env.SESSION_SECRET);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function handleMe(request, env) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: "not_logged_in" }, 401);
  return json({ login: session.login });
}

const DEFAULT_SETTINGS_FILTERS = {
  weapons: [], styles: [], biases: [], monsters: [], arts: [], blacklist: [],
  t: {
    keysOnly: false, large: true, hyper: true, capture: true,
    egg: true, gathering: true, small: true, multi: true,
    oneFaint: true, onSite: true, spArts: true,
    prowler: false, pQuests: false, allLevels: [],
  },
};

export async function handleGetFilters(request, env) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: "not_logged_in" }, 401);
  const stored = await env.MHGU_BOT_PROFILES.get(session.login);
  if (!stored) return json(DEFAULT_SETTINGS_FILTERS);
  try {
    return json(JSON.parse(stored));
  } catch (e) {
    return json(DEFAULT_SETTINGS_FILTERS);
  }
}

// Allowlist exactly the fields this Worker ever reads, rather than denylisting known-bad
// ones — this is what actually guarantees a client can't sneak an extra field (like a
// "channel" override, or stale "challenges" from an old exported file) into stored KV
// data, regardless of what the request body happens to contain.
const T_KEYS = ["keysOnly", "large", "hyper", "capture", "egg", "gathering", "small",
  "multi", "oneFaint", "onSite", "spArts", "prowler", "pQuests", "allLevels"];

function sanitizeFilters(filters) {
  const f = filters || {};
  const t = f.t || {};
  const clean = { t: {} };
  ["weapons", "styles", "biases", "monsters", "arts"].forEach((k) => {
    clean[k] = Array.isArray(f[k]) ? f[k].filter((v) => typeof v === "string") : [];
  });
  clean.blacklist = Array.isArray(f.blacklist)
    ? f.blacklist.filter((b) => b && typeof b.weapon === "string" && typeof b.style === "string")
      .map((b) => ({ weapon: b.weapon, style: b.style }))
    : [];
  T_KEYS.forEach((k) => {
    if (k === "allLevels") {
      clean.t.allLevels = Array.isArray(t.allLevels) ? t.allLevels.filter((n) => Number.isInteger(n)) : [];
    } else {
      clean.t[k] = !!t[k];
    }
  });
  return clean;
}

export async function handlePreview(request, env, DATA) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON body", { status: 400, headers: { "Content-Type": "text/plain" } });
  }
  const result = rollQuest(DATA, sanitizeFilters(body));
  if (!result) {
    return new Response("No quests match the current filters.", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response(formatForChat(result), { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function handlePublish(request, env) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: "not_logged_in" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "invalid_body" }, 400);

  // Write always targets the session's own verified login — there is no client-writable
  // channel field anywhere in this request, so there's nothing to mismatch-check.
  const filters = sanitizeFilters(body);
  await env.MHGU_BOT_PROFILES.put(session.login, JSON.stringify(filters));
  return json({ ok: true, login: session.login });
}
