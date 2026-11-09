import { randomBytes, timingSafeEqual } from 'node:crypto';

const HOST = /^(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/;

/**
 * The origin the user opened. `SPECTRUM_PUBLIC_URL` wins (set it behind a proxy). Otherwise the
 * Host header is used, because Next.js reports `localhost` in `request.url` even when the user
 * opened 127.0.0.1, and the state cookie only returns to the host that set it. GitHub accepts
 * only registered callback URLs, so a forged Host cannot redirect the code elsewhere.
 */
export function publicOrigin(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.SPECTRUM_PUBLIC_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  const url = new URL(request.url);
  const host = request.headers.get('host');
  return host && HOST.test(host) ? `${url.protocol}//${host}` : url.origin;
}

/** The OAuth callback this server registers with GitHub. */
export function callbackUrl(
  request: Request,
  env: Record<string, string | undefined> = process.env,
) {
  return `${publicOrigin(request, env)}/api/auth/github/callback`;
}

/** State cookie value: a random nonce plus the path to return to after sign-in. */
export function newState(next: string): { nonce: string; cookie: string } {
  const nonce = randomBytes(24).toString('base64url');
  return { nonce, cookie: Buffer.from(JSON.stringify({ nonce, next })).toString('base64url') };
}

/** The return path when the callback's state matches the cookie, otherwise null. */
export function verifyState(cookie: string | undefined, state: string | null): string | null {
  if (!cookie || !state) return null;
  let parsed: { nonce?: unknown; next?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(cookie, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof parsed.nonce !== 'string' || typeof parsed.next !== 'string') return null;
  const expected = Buffer.from(parsed.nonce);
  const actual = Buffer.from(state);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return parsed.next;
}
