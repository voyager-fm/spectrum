'use server';

import { cookies } from 'next/headers';
import { isGuideKey, SKIP_COOKIE, updateSkipped } from '../lib/onboarding-skip.ts';

/** Skip or restore one onboarding guide in this browser. Nothing is stored on the server. */
export async function setOnboardingSkipped(key: string, skipped: boolean): Promise<void> {
  if (!isGuideKey(key) || typeof skipped !== 'boolean') return;
  const jar = await cookies();
  const value = updateSkipped(jar.get(SKIP_COOKIE)?.value, key, skipped);
  if (!value) {
    jar.delete(SKIP_COOKIE);
    return;
  }
  jar.set(SKIP_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 86_400,
  });
}
