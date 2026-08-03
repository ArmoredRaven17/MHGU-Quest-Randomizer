import { createSessionCookie, getCookie } from "./session.js";

const STATE_COOKIE = "mhgu_oauth_state";
const SESSION_COOKIE = "mhgu_session";

// A short, unpredictable value tying the redirect back to the /auth/login that started
// it — its own unguessability is the protection, so it doesn't need signing.
function newState() {
  return crypto.randomUUID();
}

export function handleLogin(request, env) {
  const origin = new URL(request.url).origin;
  const state = newState();
  const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.TWITCH_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/auth/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      "Location": authorizeUrl.toString(),
      "Set-Cookie": `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
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

  const sessionCookie = await createSessionCookie(login, env.SESSION_SECRET);
  const clearState = `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
  const setSession = `${SESSION_COOKIE}=${sessionCookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`;

  return new Response(null, {
    status: 302,
    headers: [
      ["Location", "/settings"],
      ["Set-Cookie", clearState],
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
