// Share codes for the MHGU Bingo app (https://armoredraven17.github.io/MHGU-Bingo/).
//
// A seed can't carry a user's custom squares, and a URL long enough to do so blows past
// Twitch's ~500-character message limit. So the app uploads the finished card here and
// gets a short code back; the code is what goes in a link or a !bingo command.
//
// There is no OAuth here on purpose — the bot settings page's login flow exists for
// per-channel filter profiles, and a bingo card doesn't need an identity, just proof that
// whoever is overwriting a code is the same person who created it. On first publish the
// Worker mints both the code and a write key; only the key's hash is stored.

import { MAIN_SITE_ORIGIN } from "./auth.js";
import { generateCard } from "./bingo-gen.js";

const BINGO_APP_URL = MAIN_SITE_ORIGIN + "/MHGU-Bingo/";

// Cards are ephemeral by nature — a hunting session, a stream, a race. Without a TTL,
// abandoned cards would accumulate in KV forever.
const CARD_TTL_SECONDS = 30 * 24 * 3600;

// Bounds chosen so a legitimate 5x5 card (25 cells, longest real quest name ~45 chars)
// fits with room to spare, while an unauthenticated write can't store anything large.
const MAX_BODY_BYTES = 16 * 1024;
const MAX_TEXT = 120;
const SIZES = [3, 4, 5];

// Crockford base32, matching the app's own seed alphabet.
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function randomB32(len) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += B32[b & 31];
  return out;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time compare so a wrong key can't be narrowed down by timing.
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": MAIN_SITE_ORIGIN,
      "Cache-Control": "no-store",
    },
  });
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function handleBingoCorsPreflight() {
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

const clampStr = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

// Icons are rendered straight into an <img src> by whoever opens the link, so only the
// app's own bundled asset paths are allowed through. Anything else — an absolute URL, a
// data: URI, a traversal — is dropped rather than rejected, so one odd cell can't stop a
// card being shared.
function cleanIcon(v) {
  if (typeof v !== "string") return "";
  if (!/^assets\/[A-Za-z0-9_\-./]+$/.test(v)) return "";
  if (v.includes("..")) return "";
  return v.slice(0, 200);
}

// Only a colour literal, never arbitrary CSS — this lands in an inline style.
const cleanTint = (v) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : "");

// Allowlists every field the bingo app reads back, so nothing a client invents can be
// stored and later handed to another viewer.
function sanitizeCard(body) {
  if (!body || typeof body !== "object") return null;
  const size = parseInt(body.size, 10);
  if (!SIZES.includes(size)) return null;
  if (!Array.isArray(body.cells) || body.cells.length !== size * size) return null;

  const freeIdx = Number.isInteger(body.freeIdx) ? body.freeIdx : -1;
  return {
    seed: clampStr(body.seed, 64),
    size,
    freeIdx: freeIdx >= 0 && freeIdx < size * size ? freeIdx : -1,
    cells: body.cells.map(c => ({
      cat:  clampStr(c && c.cat, 16),
      key:  clampStr(c && c.key, MAX_TEXT + 8),
      text: clampStr(c && c.text, MAX_TEXT),
      sub:  clampStr(c && c.sub, 48),
      icon: cleanIcon(c && c.icon),
      tint: cleanTint(c && c.tint),
    })),
  };
}

async function readBody(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { error: "too_large" };
  try {
    return { body: JSON.parse(raw) };
  } catch (e) {
    return { error: "invalid_json" };
  }
}

// POST /bingo          → create a card, mint {code, key}
// POST /bingo/:code    → overwrite that card; requires Authorization: Bearer <key>
export async function handleBingoPublish(request, env, code) {
  const { body, error } = await readBody(request);
  if (error) return json({ error }, error === "too_large" ? 413 : 400);

  const card = sanitizeCard(body);
  if (!card) return json({ error: "invalid_card" }, 400);

  if (code) {
    const stored = await env.MHGU_BINGO_CARDS.get(code, "json");
    if (!stored) return json({ error: "not_found" }, 404);
    const m = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
    const supplied = m ? m[1].trim() : "";
    if (!timingSafeEqual(await sha256Hex(supplied), stored.keyHash)) {
      return json({ error: "forbidden" }, 403);
    }
    await env.MHGU_BINGO_CARDS.put(
      code,
      JSON.stringify({ keyHash: stored.keyHash, card, updated: Date.now() }),
      { expirationTtl: CARD_TTL_SECONDS },
    );
    return json({ code });
  }

  const newCode = randomB32(6);
  const key = randomB32(32);
  await env.MHGU_BINGO_CARDS.put(
    newCode,
    JSON.stringify({ keyHash: await sha256Hex(key), card, updated: Date.now() }),
    { expirationTtl: CARD_TTL_SECONDS },
  );
  return json({ code: newCode, key });
}

// GET /bingo/:code → the card itself, for the app to render.
export async function handleBingoGet(env, code) {
  const stored = await env.MHGU_BINGO_CARDS.get(code, "json");
  if (!stored || !stored.card) return json({ error: "not_found" }, 404);
  return json(stored.card);
}

// GET /bingo → roll a brand-new card, store it, and hand chat a link plus its seed.
// This is what a `!bingo` command points at: every viewer who runs it gets a fresh board,
// and the seed lets anyone rebuild that same board in the app.
//
// Cards from here are stored with an empty keyHash, so the overwrite path can never match
// — a bot-rolled card has no owner and nothing to authorise.
export async function handleBingoRoll(env, DATA) {
  const card = generateCard(DATA);
  const code = randomB32(6);
  await env.MHGU_BINGO_CARDS.put(
    code,
    JSON.stringify({ keyHash: "", card, updated: Date.now() }),
    { expirationTtl: CARD_TTL_SECONDS },
  );
  return text("New bingo card: " + BINGO_APP_URL + "?c=" + code + " — Seed: " + card.seed);
}

// GET /bingo-set?c=slot&key=... → !setcurrentcard. Rolls a fresh card straight INTO the
// streamer's existing slot, so the command URL never changes and neither does the
// !currentcard URL pointing at it. That's the whole point: a card code baked into a bot
// command would go stale the moment a new card was made.
//
// The key lives in the command's URL, so this must be mod-restricted in the bot —
// anyone who can read the command definition can reroll the stream's card.
export async function handleBingoSet(url, env, DATA) {
  const slot = (url.searchParams.get("c") || "").trim().toUpperCase();
  const key = (url.searchParams.get("key") || "").trim();
  if (!/^[0-9A-Z]{6}$/.test(slot)) {
    return text("This command isn't set up yet — publish a card in the MHGU Bingo app to get its URL.");
  }
  const rec = await env.MHGU_BINGO_CARDS.get(slot, "json");
  if (!rec) return text("That card slot has expired — publish again in the app to set it back up.");
  // Bot-rolled cards store an empty keyHash and can never be claimed as a slot.
  if (!rec.keyHash || !timingSafeEqual(await sha256Hex(key), rec.keyHash)) {
    return text("Not allowed.");
  }
  const card = generateCard(DATA);
  await env.MHGU_BINGO_CARDS.put(
    slot,
    JSON.stringify({ keyHash: rec.keyHash, card, updated: Date.now() }),
    { expirationTtl: CARD_TTL_SECONDS },
  );
  return text("New stream card: " + BINGO_APP_URL + "?c=" + slot + " — Seed: " + card.seed);
}

// GET /bingo-link?c=code → plain text for a chat bot's urlfetch. Kept deliberately short:
// Nightbot/Moobot paste the response verbatim into chat.
export async function handleBingoLink(url, env) {
  const code = (url.searchParams.get("c") || "").trim().toUpperCase();
  if (!/^[0-9A-Z]{6}$/.test(code)) return text("Usage: !bingo needs a card code.");
  const stored = await env.MHGU_BINGO_CARDS.get(code, "json");
  if (!stored) return text("That bingo card has expired or doesn't exist.");
  return text("Current bingo card: " + BINGO_APP_URL + "?c=" + code);
}
