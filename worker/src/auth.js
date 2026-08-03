import { createSessionCookie, getCookie } from "./session.js";

const STATE_COOKIE = "mhgu_oauth_state";
const SESSION_COOKIE = "mhgu_session";
// Set only when /auth/login?return=main is requested — a fixed literal, never the query
// value itself, so handleCallback's redirect destination is always a hardcoded constant
// rather than anything attacker-influenced.
const RETURN_COOKIE = "mhgu_return_main";

// The main GitHub Pages site — a separate origin from this Worker. Exported for api.js's
// CORS headers (an exact origin match, no path/trailing slash).
export const MAIN_SITE_ORIGIN = "https://armoredraven17.github.io";
export const MAIN_SITE_URL = MAIN_SITE_ORIGIN + "/MHGU-Quest-Randomizer/";

// A short, unpredictable value tying the redirect back to the /auth/login that started
// it — its own unguessability is the protection, so it doesn't need signing.
function newState() {
  return crypto.randomUUID();
}

export function handleLogin(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const state = newState();
  const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.TWITCH_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/auth/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);

  const headers = [
    ["Location", authorizeUrl.toString()],
    ["Set-Cookie", `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`],
  ];
  // Optional: the main site (a different origin) sends people through this same login,
  // then wants to land back on itself instead of /settings — see handleCallback below.
  if (url.searchParams.get("return") === "main") {
    headers.push(["Set-Cookie", `${RETURN_COOKIE}=main; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`]);
  }

  return new Response(null, { status: 302, headers });
}

export async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = getCookie(request, STATE_COOKIE);

  if (!code || !state || !cookieState || state !== cookieState) {
    return new Response("Login failed: invalid or expired state. Please try logging in again.", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const origin = url.origin;
  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${origin}/auth/callback`,
    }),
  });
  if (!tokenRes.ok) {
    return new Response("Login failed: could not exchange code with Twitch.", { status: 502, headers: { "Content-Type": "text/plain" } });
  }
  const tokenData = await tokenRes.json();

  const userRes = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      "Authorization": `Bearer ${tokenData.access_token}`,
      "Client-Id": env.TWITCH_CLIENT_ID,
    },
  });
  if (!userRes.ok) {
    return new Response("Login failed: could not fetch Twitch user info.", { status: 502, headers: { "Content-Type": "text/plain" } });
  }
  const userData = await userRes.json();
  const login = userData.data && userData.data[0] && userData.data[0].login;
  if (!login) {
    return new Response("Login failed: Twitch didn't return a user login.", { status: 502, headers: { "Content-Type": "text/plain" } });
  }

  const returnMain = getCookie(request, RETURN_COOKIE) === "main";

  const sessionCookie = await createSessionCookie(login, env.SESSION_SECRET);
  const clearState = `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
  const clearReturn = `${RETURN_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
  const setSession = `${SESSION_COOKIE}=${sessionCookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`;

  // The only two possible destinations are these hardcoded strings — returnMain is a
  // boolean derived from a fixed cookie value, never a URL built from user input. The
  // main-site path carries the session token in the URL *fragment* (never sent to any
  // server, never in a Referer header) for the main site's JS to pick up and use as a
  // bearer token — see docs/app.js's initTwitchSync(). The httponly cookie is still set
  // either way, so the settings page's own same-origin cookie flow is unaffected.
  const location = returnMain
    ? `${MAIN_SITE_URL}#mhgu_bot_token=${encodeURIComponent(sessionCookie)}`
    : "/settings";

  return new Response(null, {
    status: 302,
    headers: [
      ["Location", location],
      ["Set-Cookie", clearState],
      ["Set-Cookie", clearReturn],
      ["Set-Cookie", setSession],
    ],
  });
}

export function handleLogout() {
  return new Response(null, {
    status: 302,
    headers: [
      ["Location", "/settings"],
      ["Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`],
    ],
  });
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
