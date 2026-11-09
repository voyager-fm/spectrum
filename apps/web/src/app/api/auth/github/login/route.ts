import { oauthAuthorizeUrl } from '@spectrum/integrations/github';
import { NextResponse } from 'next/server';
import { accountsConfig, STATE_COOKIE, safeNext } from '../../../../../lib/auth.ts';
import { callbackUrl, newState, publicOrigin } from '../../../../../lib/oauth.ts';

/** Start GitHub sign-in through the App's user authorization. */
export function GET(request: Request) {
  const config = accountsConfig();
  if (config.status !== 'on') {
    return new Response(null, { status: 303, headers: { Location: '/sign-in' } });
  }
  const next = safeNext(new URL(request.url).searchParams.get('next'));
  const { nonce, cookie } = newState(next);
  const response = NextResponse.redirect(
    oauthAuthorizeUrl({
      clientId: config.clientId,
      redirectUri: callbackUrl(request),
      state: nonce,
    }),
    303,
  );
  response.cookies.set(STATE_COOKIE, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: publicOrigin(request).startsWith('https:'),
    path: '/api/auth/github',
    maxAge: 600,
  });
  return response;
}
