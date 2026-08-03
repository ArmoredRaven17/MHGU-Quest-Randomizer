// Signed session cookie using only Web Crypto (crypto.subtle) — native to Workers, no
// dependency needed. The cookie itself is the session: a base64url {login, exp} payload
// plus an HMAC-SHA256 signature, so there's nothing to look up server-side to validate it.

const enc = new TextEncoder();

function b64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

export async function createSessionCookie(login, secret) {
  const payload = JSON.stringify({ login, exp: Date.now() + SESSION_TTL_MS });
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${b64urlEncode(enc.encode(payload))}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verifySessionCookie(cookieValue, secret) {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [p, s] = parts;
  let payloadBytes, sigBytes;
  try {
    payloadBytes = b64urlDecode(p);
    sigBytes = b64urlDecode(s);
  } catch (e) {
    return null;
  }
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, payloadBytes);
  if (!ok) return null;
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch (e) {
    return null;
  }
  if (!data.login || !data.exp || data.exp < Date.now()) return null;
  return { login: data.login };
}

// Minimal cookie-header parser — just enough to find one named cookie.
export function getCookie(request, name) {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}
