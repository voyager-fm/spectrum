import { exchangeOAuthCode, GitHubUserClient } from '@spectrum/integrations/github';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  createSession,
  deleteExpiredSessions,
  syncMemberships,
  upsertUser,
} from '../../../../../db/store.ts';
import {
  accountsConfig,
  SESSION_COOKIE,
  STATE_COOKIE,
  safeNext,
  sessionCookieOptions,
} from '../../../../../lib/auth.ts';
import { callbackUrl, publicOrigin, verifyState } from '../../../../../lib/oauth.ts';

const STATE_PATH = '/api/auth/github';

/** A relative Location keeps the host the user opened; `request.url` may say localhost. */
function seeOther(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

function fail(reason: string) {
  const response = seeOther(`/sign-in?error=${reason}`);
  response.cookies.delete({ name: STATE_COOKIE, path: STATE_PATH });
  return response;
}

/**
 * GitHub returns here after the user authorizes the App. The user token is used once, to read
 * the user and the installations they can access, and is then dropped; it is never stored.
 */
export async function GET(request: Request) {
  const config = accountsConfig();
  if (config.status !== 'on') return fail('not-enabled');
  const url = new URL(request.url);
  const next = verifyState(
    (await cookies()).get(STATE_COOKIE)?.value,
    url.searchParams.get('state'),
  );
  if (url.searchParams.get('error')) return fail('denied');
  const code = url.searchParams.get('code');
  if (next === null || !code) return fail('state');

  let github: Awaited<ReturnType<GitHubUserClient['getUser']>>;
  let installations: Awaited<ReturnType<GitHubUserClient['listInstallations']>>;
  try {
    const token = await exchangeOAuthCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      redirectUri: callbackUrl(request),
    });
    const client = new GitHubUserClient({ token });
    [github, installations] = await Promise.all([client.getUser(), client.listInstallations()]);
  } catch {
    return fail('github');
  }

  let session: string;
  try {
    const now = new Date();
    const user = await upsertUser(config.db, github, now);
    await syncMemberships(config.db, user.id, installations, now);
    await deleteExpiredSessions(config.db, now);
    session = await createSession(config.db, user.id, now);
  } catch {
    return fail('database');
  }
  const response = seeOther(safeNext(next));
  response.cookies.set(
    SESSION_COOKIE,
    session,
    sessionCookieOptions(publicOrigin(request).startsWith('https:')),
  );
  response.cookies.delete({ name: STATE_COOKIE, path: STATE_PATH });
  return response;
}
