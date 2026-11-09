import { cookies } from 'next/headers.js';
import type { Database } from '../db/client.ts';
import { database } from '../db/client.ts';
import {
  type AccessibleInstallation,
  accessibleInstallations,
  SESSION_DAYS,
  sessionUser,
  type User,
} from '../db/store.ts';

/**
 * Who is looking at the dashboard.
 * - `single-operator`: no accounts are configured. The server operator is the only user, and
 *   every installation the App can read is visible. Intended for a local machine.
 * - `accounts`: sign-in with GitHub is required, and a user sees only the installations GitHub
 *   reported for them at their last sign-in.
 * - `misconfigured`: some account variables are set and others are missing. Repository data is
 *   withheld rather than falling back to the open mode.
 */
export type Viewer =
  | { mode: 'single-operator' }
  | { mode: 'misconfigured'; missing: string[] }
  | { mode: 'accounts'; user: User | null; installations: AccessibleInstallation[] };

export const ACCOUNT_ENV = [
  'DATABASE_URL',
  'GITHUB_APP_CLIENT_ID',
  'GITHUB_APP_CLIENT_SECRET',
] as const;

export const SESSION_COOKIE = 'spectrum_session';
export const STATE_COOKIE = 'spectrum_oauth_state';

type Env = Record<string, string | undefined>;

export interface AccountsConfig {
  clientId: string;
  clientSecret: string;
  db: Database;
}

/** Account settings, or which names are missing. Never returns secret values to callers that render. */
export function accountsConfig(
  env: Env = process.env,
):
  | { status: 'off' }
  | { status: 'partial'; missing: string[] }
  | ({ status: 'on' } & AccountsConfig) {
  const present = ACCOUNT_ENV.filter((name) => env[name]?.trim());
  if (present.length === 0) return { status: 'off' };
  const missing = ACCOUNT_ENV.filter((name) => !env[name]?.trim());
  if (missing.length) return { status: 'partial', missing: [...missing] };
  const db = database(env);
  if (!db) return { status: 'partial', missing: ['DATABASE_URL'] };
  return {
    status: 'on',
    clientId: (env.GITHUB_APP_CLIENT_ID as string).trim(),
    clientSecret: (env.GITHUB_APP_CLIENT_SECRET as string).trim(),
    db,
  };
}

/** Resolve the viewer from the session cookie. A database failure withholds data. */
export async function currentViewer(env: Env = process.env): Promise<Viewer> {
  const config = accountsConfig(env);
  if (config.status === 'off') return { mode: 'single-operator' };
  if (config.status === 'partial') return { mode: 'misconfigured', missing: config.missing };
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { mode: 'accounts', user: null, installations: [] };
  try {
    const user = await sessionUser(config.db, token, new Date());
    if (!user) return { mode: 'accounts', user: null, installations: [] };
    return {
      mode: 'accounts',
      user,
      installations: await accessibleInstallations(config.db, user.id),
    };
  } catch {
    return { mode: 'misconfigured', missing: ['a reachable, migrated DATABASE_URL'] };
  }
}

/** Whether this viewer may read repositories of an installation. */
export function canRead(viewer: Viewer, installationId: number): boolean {
  if (viewer.mode === 'single-operator') return true;
  if (viewer.mode === 'misconfigured' || !viewer.user) return false;
  return viewer.installations.some((i) => i.installationId === installationId);
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  };
}

/** Only same-site relative paths are followed after sign-in. */
export function safeNext(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  return value;
}
