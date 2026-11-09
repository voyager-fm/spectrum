import { accountsConfig } from '../../../../lib/auth.ts';

/**
 * GitHub App Setup URL. GitHub redirects here after an installation changes. The query
 * (installation_id, setup_action) is not trusted or stored. With accounts enabled, the user signs
 * in again so their workspaces are synced from GitHub; otherwise they return to the list.
 */
export function GET() {
  // A relative Location keeps the host the user actually opened (127.0.0.1, localhost or a tunnel).
  const location =
    accountsConfig().status === 'on'
      ? '/api/auth/github/login?next=%2Frepositories'
      : '/repositories';
  return new Response(null, { status: 303, headers: { Location: location } });
}
