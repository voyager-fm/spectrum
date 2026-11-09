/**
 * GitHub App Setup URL. GitHub redirects here after an installation changes. The query
 * (installation_id, setup_action) is not trusted or stored; the repositories page reads the
 * installation list from GitHub with App credentials instead.
 */
export function GET() {
  // A relative Location keeps the host the user actually opened (127.0.0.1, localhost or a tunnel).
  return new Response(null, { status: 303, headers: { Location: '/repositories' } });
}
