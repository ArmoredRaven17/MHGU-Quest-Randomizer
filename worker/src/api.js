import { verifySessionCookie, getCookie } from "./session.js";
import { SESSION_COOKIE_NAME, MAIN_SITE_ORIGIN } from "./auth.js";
import { rollQuest, formatForChat } from "./randomizer.js";

// Accepts either the settings page's own same-origin cookie, or a bearer token (used by
// the main site, a different origin, since Safari's ITP unreliably blocks/expires
// cross-site cookies — a token in localStorage sidesteps that entirely). The session
// value itself is just a signed string either way, so verifySessionCookie doesn't care
// which transport it arrived by.
async function requireSession(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : getCookie(request, SESSION_COOKIE_NAME);
  return verifySessionCookie(token, env.SESSION_SECRET);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": MAIN_SITE_ORIGIN },
  });
}

// Preflight for the main site's cross-origin bearer-token requests. No
// Access-Control-Allow-Credentials — this is a bearer token, not a cookie, so the main
// site never sends credentials:'include'.
export function handleCorsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": MAIN_SITE_ORIGIN,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function handleMe(request, env) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: "not_logged_in" }, 401);
  return json({ login: session.login });
}

// Matches docs/app.js's DEFAULT_CHALLENGES — new/never-published settings start with
// the same four unchecked presets as the main site.
const DEFAULT_CHALLENGES = [
  { text: "No Armor", chance: 10, checked: false },
  { text: "No Items", chance: 10, checked: false },
  { text: "No Active Skills", chance: 10, checked: false },
  { text: "Use Joke Weapon", chance: 10, checked: false },
];

const DEFAULT_SETTINGS_FILTERS = {
  weapons: [], styles: [], biases: [], monsters: [], arts: [], blacklist: [],
  challenges: DEFAULT_CHALLENGES.map((c) => ({ ...c })),
  challengeCount: 1,
  t: {
    keysOnly: false, large: true, hyper: true, capture: true,
    egg: true, gathering: true, small: true, multi: true,
    oneFaint: true, onSite: true, spArts: true,
    prowler: false, pQuests: false, rollBias: true, chaosMode: false, allLevels: [],
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
  "multi", "oneFaint", "onSite", "spArts", "prowler", "pQuests", "rollBias", "chaosMode", "allLevels"];

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
  // Capped at 50 entries — main site has no such cap since it's local-only storage, but
  // this is a public write endpoint and free-text challenge names are otherwise unbounded.
  clean.challenges = Array.isArray(f.challenges)
    ? f.challenges.filter((c) => c && typeof c.text === "string").slice(0, 50).map((c) => ({
        text: c.text.slice(0, 21),
        chance: Math.min(100, Math.max(1, Number.isFinite(c.chance) ? Math.round(c.chance) : 10)),
        checked: !!c.checked,
      }))
    : [];
  clean.challengeCount = Math.min(8, Math.max(1, parseInt(f.challengeCount, 10) || 1));
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
