import { cookies } from 'next/headers';
import { deleteSession } from '../../../../db/store.ts';
import { accountsConfig, SESSION_COOKIE } from '../../../../lib/auth.ts';

/** End the session. POST only, so a link or image elsewhere cannot sign the user out. */
export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const config = accountsConfig();
  if (token && config.status === 'on') await deleteSession(config.db, token).catch(() => {});
  jar.delete(SESSION_COOKIE);
  return new Response(null, { status: 303, headers: { Location: '/' } });
}
