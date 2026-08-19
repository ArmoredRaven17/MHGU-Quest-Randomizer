// One live MHGU Talisman Bingo session: a Gamemaster draws, an audience follows along.
//
// This object holds ONE INTEGER of consequence — the current draw number. It never sees a
// talisman, a card, a square or a mark, and it must never be given them. The client's
// drawAt(n) is a pure function of (session string, n), so every viewer turns that integer
// into the identical charm locally. That is the whole trick, and it is why nothing here
// imports the app's roll/goal/data modules.
//
// The sibling MHGU Bingo feature took the other road: worker/src/bingo-gen.js is a
// hand-maintained byte-faithful mirror of that app's client generator, and its git history
// is a wall of "Mirror the X into the bingo generator" commits. Do not repeat that here.
//
// WHY A DURABLE OBJECT AND NOT KV, which is all this Worker used before:
//
//   1. KV has no compare-and-swap. The load-bearing guarantee of this feature is that the
//      draw number NEVER GOES BACKWARDS — hundreds of viewers cannot be un-shown a draw
//      they have already marked. On KV, two racing writes are last-write-wins, and a stale
//      reader computing n+1 can genuinely LOWER the counter. The guarantee would be a hope.
//   2. KV writes take up to ~60s to propagate, and its edge cache has a 60s minimum TTL, so
//      a viewer in another colo could sit a full minute behind. The baseline this feature
//      has to beat is "the Gamemaster says the number out loud", and a minute is worse.
//
// A Durable Object is single-threaded per object, so `n = max(n, requested)` below is
// atomic by construction rather than by agreement.
import { DurableObject } from "cloudflare:workers";

// Abandoned sessions would otherwise sit here forever — the same reasoning behind the
// expirationTtl on every KV write in bingo.js.
const IDLE_TTL_MS = 24 * 3600 * 1000;

// A draw is a human pressing a button and reading a talisman aloud; anything faster is a
// double-click or a stuck key. Enforced here rather than in the Worker because a Durable
// Object is the only place in this codebase where a rate limit can be exact.
const MIN_DRAW_GAP_MS = 250;
const BURST_WINDOW_MS = 10000;
const BURST_MAX = 20;

export class LiveSession extends DurableObject {
  // No I/O in the constructor: it runs on every wake, including alarms.
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  async #meta() {
    return (await this.ctx.storage.get("meta")) || null;
  }

  async #touch() {
    await this.ctx.storage.put("touched", Date.now());
    // Re-armed on every write rather than set once, so an active session never expires
    // mid-stream and an abandoned one always does.
    await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
  }

  // First claim wins. `meta` is immutable afterwards, so a session's owner and its seed
  // can never be swapped out from under the viewers already following it.
  async claim({ session, owner }) {
    const meta = await this.#meta();
    if (meta) {
      if (meta.owner !== owner) return { error: "already_claimed" };
      // Re-claiming your own session is how a Gamemaster restarts: the counter resets but
      // the session string is unchanged, so every viewer's card stays valid and only the
      // draw number goes back to zero. That is a deliberate reset, not a rewind.
      await this.ctx.storage.put("n", 0);
      await this.ctx.storage.put("ended", false);
      await this.#touch();
      return { session: meta.session, owner: meta.owner, n: 0, ended: false };
    }
    const fresh = { session, owner, createdAt: Date.now() };
    await this.ctx.storage.put("meta", fresh);
    await this.ctx.storage.put("n", 0);
    await this.ctx.storage.put("ended", false);
    await this.#touch();
    return { session, owner, n: 0, ended: false };
  }

  async read() {
    const meta = await this.#meta();
    if (!meta) return null;
    const [n, ended, updated] = await Promise.all([
      this.ctx.storage.get("n"),
      this.ctx.storage.get("ended"),
      this.ctx.storage.get("touched"),
    ]);
    return {
      session: meta.session,
      owner: meta.owner,
      n: n | 0,
      ended: !!ended,
      updated: updated || meta.createdAt,
    };
  }

  // `n` is a TARGET, not an increment. That makes a retried request idempotent, makes the
  // counter monotonic by construction, and lets a Gamemaster who reconnects already ahead
  // simply state where they are. There is deliberately no way to lower it.
  async draw({ owner, n }) {
    const meta = await this.#meta();
    if (!meta) return { error: "not_found" };
    if (meta.owner !== owner) return { error: "forbidden" };
    if (await this.ctx.storage.get("ended")) return { error: "ended" };

    // Timed against the last DRAW, not `touched`. `touched` is also written by claim() and
    // end(), so sharing it made a Gamemaster's very first draw -- the one immediately after
    // claiming -- always fail as "too fast".
    const now = Date.now();
    const last = (await this.ctx.storage.get("lastDraw")) || 0;
    if (now - last < MIN_DRAW_GAP_MS) return { error: "too_fast" };

    const burst = (await this.ctx.storage.get("burst")) || { since: now, count: 0 };
    if (now - burst.since > BURST_WINDOW_MS) { burst.since = now; burst.count = 0; }
    if (++burst.count > BURST_MAX) return { error: "too_fast" };
    await this.ctx.storage.put("burst", burst);

    const cur = (await this.ctx.storage.get("n")) | 0;
    const next = Math.max(cur, n | 0);
    if (next !== cur) await this.ctx.storage.put("n", next);
    await this.ctx.storage.put("lastDraw", now);
    await this.#touch();
    return { session: meta.session, n: next, ended: false };
  }

  async end({ owner }) {
    const meta = await this.#meta();
    if (!meta) return { error: "not_found" };
    if (meta.owner !== owner) return { error: "forbidden" };
    await this.ctx.storage.put("ended", true);
    await this.#touch();
    return { session: meta.session, n: (await this.ctx.storage.get("n")) | 0, ended: true };
  }

  async destroy({ owner }) {
    const meta = await this.#meta();
    if (!meta) return { error: "not_found" };
    if (meta.owner !== owner) return { error: "forbidden" };
    await this.ctx.storage.deleteAll();
    return { ok: true };
  }

  // Reads 404 after this, which the client shows as "the session ended".
  async alarm() {
    const touched = (await this.ctx.storage.get("touched")) || 0;
    if (Date.now() - touched >= IDLE_TTL_MS) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(touched + IDLE_TTL_MS);
  }
}
