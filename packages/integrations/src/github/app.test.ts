import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { text } from 'node:stream/consumers';
import { describe, it } from 'node:test';
import {
  createAppJwt,
  exchangeOAuthCode,
  type Fetch,
  GitHubApp,
  GitHubError,
  GitHubRepositoryClient,
  GitHubUserClient,
  oauthAuthorizeUrl,
  validRef,
  validRepositoryName,
} from './app.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const NOW = Date.parse('2026-11-09T00:00:00Z');

interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
}

/** Labeled mock: an in-memory GitHub API, never a live call. */
function mockGitHub(routes: Record<string, () => Response>) {
  const calls: Call[] = [];
  const fetcher: Fetch = async (url, init) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, headers: init?.headers as Record<string, string> });
    const route = routes[`${method} ${url.replace('https://api.github.com', '')}`];
    return route ? route() : new Response('{"message":"Not Found"}', { status: 404 });
  };
  return { fetcher, calls };
}

const ok = (body: unknown) => () => Response.json(body);

describe('createAppJwt', () => {
  it('signs an RS256 token with a backdated issue time and a short expiry', () => {
    const jwt = createAppJwt('123', pem, NOW);
    const [header, payload, signature] = jwt.split('.') as [string, string, string];
    assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), {
      alg: 'RS256',
      typ: 'JWT',
    });
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    assert.equal(claims.iss, '123');
    assert.equal(claims.iat, NOW / 1000 - 60);
    assert.equal(claims.exp, NOW / 1000 + 540);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${payload}`);
    assert.equal(verifier.verify(publicKey, Buffer.from(signature, 'base64url')), true);
  });
});

describe('GitHubApp', () => {
  it('lists installations with the App JWT and versioned headers', async () => {
    const { fetcher, calls } = mockGitHub({
      'GET /app/installations?per_page=100&page=1': ok([
        { id: 7, target_type: 'Organization', account: { login: 'voyager-fm', id: 99 } },
      ]),
    });
    const app = new GitHubApp({ appId: '123', privateKey: pem, fetch: fetcher, now: () => NOW });
    assert.deepEqual(await app.listInstallations(), [
      { id: 7, account: 'voyager-fm', accountId: 99, targetType: 'Organization' },
    ]);
    const headers = calls[0]?.headers ?? {};
    assert.equal(headers.Accept, 'application/vnd.github+json');
    assert.equal(headers['X-GitHub-Api-Version'], '2022-11-28');
    assert.match(headers.Authorization ?? '', /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('reuses an installation token until five minutes before it expires', async () => {
    let now = NOW;
    let issued = 0;
    const { fetcher } = mockGitHub({
      'POST /app/installations/7/access_tokens': () => {
        issued++;
        return Response.json({
          token: `ghs_${issued}`,
          expires_at: new Date(now + 60 * 60_000).toISOString(),
        });
      },
    });
    const app = new GitHubApp({ appId: '1', privateKey: pem, fetch: fetcher, now: () => now });
    assert.equal(await app.installationToken(7), 'ghs_1');
    now += 50 * 60_000;
    assert.equal(await app.installationToken(7), 'ghs_1');
    now += 6 * 60_000;
    assert.equal(await app.installationToken(7), 'ghs_2');
  });

  it('lists installed repositories with the installation token', async () => {
    const { fetcher, calls } = mockGitHub({
      'POST /app/installations/7/access_tokens': ok({
        token: 'ghs_secret',
        expires_at: '2026-11-09T01:00:00Z',
      }),
      'GET /installation/repositories?per_page=100&page=1': ok({
        repositories: [
          {
            id: 1450780976,
            name: 'spectrum',
            full_name: 'voyager-fm/spectrum',
            private: false,
            default_branch: 'main',
            html_url: 'https://github.com/voyager-fm/spectrum',
            owner: { login: 'voyager-fm' },
          },
        ],
      }),
    });
    const app = new GitHubApp({ appId: '1', privateKey: pem, fetch: fetcher, now: () => NOW });
    const [repo] = await app.listRepositories(7);
    assert.equal(repo?.fullName, 'voyager-fm/spectrum');
    assert.equal(repo?.id, 1450780976);
    assert.equal(repo?.defaultBranch, 'main');
    assert.equal(calls[1]?.headers.Authorization, 'Bearer ghs_secret');
  });

  it('maps a missing installation to null instead of an error', async () => {
    const { fetcher } = mockGitHub({});
    const app = new GitHubApp({ appId: '1', privateKey: pem, fetch: fetcher, now: () => NOW });
    assert.equal(await app.repositoryInstallation('someone', 'elsewhere'), null);
    assert.equal(await app.repositoryClient('someone', 'elsewhere'), null);
  });

  it('rejects repository names that are not single path segments', async () => {
    const { fetcher, calls } = mockGitHub({});
    const app = new GitHubApp({ appId: '1', privateKey: pem, fetch: fetcher, now: () => NOW });
    await assert.rejects(app.repositoryClient('voyager-fm', '../x'), GitHubError);
    assert.equal(calls.length, 0);
    assert.equal(validRepositoryName('voyager-fm', 'spectrum'), true);
    assert.equal(validRepositoryName('a/b', 'c'), false);
    assert.equal(validRepositoryName('a', '..'), false);
  });
});

describe('GitHubRepositoryClient', () => {
  it('pins a branch name with slashes to a commit SHA', async () => {
    const { fetcher, calls } = mockGitHub({
      'GET /repos/voyager-fm/spectrum/commits/feat/github': ok({ sha: 'a'.repeat(40) }),
    });
    const client = new GitHubRepositoryClient({
      owner: 'voyager-fm',
      repo: 'spectrum',
      token: 'ghs_secret',
      fetch: fetcher,
    });
    assert.equal(await client.resolveCommit('feat/github'), 'a'.repeat(40));
    assert.equal(calls.length, 1);
  });

  it('rejects refs that could escape the commits path', async () => {
    const client = new GitHubRepositoryClient({ owner: 'o', repo: 'r', token: 't' });
    await assert.rejects(client.resolveCommit('../../user'), GitHubError);
    assert.equal(validRef('main'), true);
    assert.equal(validRef('a..b'), true);
    assert.equal(validRef('a/../b'), false);
    assert.equal(validRef('bad ref'), false);
  });

  it('lists open pull requests with their head SHA', async () => {
    const { fetcher } = mockGitHub({
      'GET /repos/o/r/pulls?state=open&per_page=100&page=1': ok([
        {
          number: 4,
          title: 'Add GitHub',
          html_url: 'https://github.com/o/r/pull/4',
          head: { ref: 'feat/github', sha: 'b'.repeat(40) },
        },
      ]),
    });
    const client = new GitHubRepositoryClient({
      owner: 'o',
      repo: 'r',
      token: 't',
      fetch: fetcher,
    });
    assert.deepEqual(await client.listOpenPullRequests(), [
      {
        number: 4,
        title: 'Add GitHub',
        headRef: 'feat/github',
        headSha: 'b'.repeat(40),
        htmlUrl: 'https://github.com/o/r/pull/4',
      },
    ]);
  });

  it('streams the tarball only for a full commit SHA', async () => {
    const sha = 'c'.repeat(40);
    const { fetcher } = mockGitHub({
      [`GET /repos/o/r/tarball/${sha}`]: () => new Response('archive-bytes'),
    });
    const client = new GitHubRepositoryClient({
      owner: 'o',
      repo: 'r',
      token: 't',
      fetch: fetcher,
    });
    assert.equal(await text(await client.downloadTarball(sha)), 'archive-bytes');
    await assert.rejects(client.downloadTarball('main'), GitHubError);
  });

  it('reports the status without the token when GitHub refuses', async () => {
    const { fetcher } = mockGitHub({
      'GET /repos/o/r': () => new Response('{"message":"Bad credentials"}', { status: 401 }),
    });
    const client = new GitHubRepositoryClient({
      owner: 'o',
      repo: 'r',
      token: 'ghs_secret',
      fetch: fetcher,
    });
    await assert.rejects(client.getRepository(), (error: unknown) => {
      assert.ok(error instanceof GitHubError);
      assert.equal(error.status, 401);
      assert.doesNotMatch(error.message, /ghs_secret/);
      return true;
    });
  });
});

describe('user authorization', () => {
  it('builds an authorization URL that carries the state and callback', () => {
    const url = new URL(
      oauthAuthorizeUrl({
        clientId: 'Iv1.abc',
        redirectUri: 'http://127.0.0.1:3000/cb',
        state: 's1',
      }),
    );
    assert.equal(url.origin + url.pathname, 'https://github.com/login/oauth/authorize');
    assert.equal(url.searchParams.get('client_id'), 'Iv1.abc');
    assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:3000/cb');
    assert.equal(url.searchParams.get('state'), 's1');
  });

  it('exchanges a code for a token and keeps secrets out of errors', async () => {
    const seen: string[] = [];
    const fetcher: Fetch = async (url, init) => {
      seen.push(`${init?.method} ${url}`);
      const body = JSON.parse(String(init?.body));
      if (body.code === 'good') return Response.json({ access_token: 'ghu_token' });
      return Response.json({ error: 'bad_verification_code' });
    };
    const base = {
      clientId: 'id',
      clientSecret: 'shh',
      redirectUri: 'http://x/cb',
      fetch: fetcher,
    };
    assert.equal(await exchangeOAuthCode({ ...base, code: 'good' }), 'ghu_token');
    assert.deepEqual(seen, ['POST https://github.com/login/oauth/access_token']);
    await assert.rejects(exchangeOAuthCode({ ...base, code: 'bad' }), (error: Error) => {
      assert.ok(error instanceof GitHubError);
      assert.match(error.message, /bad_verification_code/);
      assert.doesNotMatch(error.message, /shh|bad\b/);
      return true;
    });
  });

  it('reads the user and the installations the user can access', async () => {
    const { fetcher, calls } = mockGitHub({
      'GET /user': ok({ id: 5, login: 'octo', name: null, avatar_url: 'https://a/5' }),
      'GET /user/installations?per_page=100&page=1': ok({
        installations: [
          { id: 7, target_type: 'Organization', account: { login: 'voyager-fm', id: 99 } },
        ],
      }),
    });
    const user = new GitHubUserClient({ token: 'ghu_token', fetch: fetcher });
    assert.deepEqual(await user.getUser(), {
      id: 5,
      login: 'octo',
      name: null,
      avatarUrl: 'https://a/5',
    });
    assert.deepEqual(await user.listInstallations(), [
      { id: 7, account: 'voyager-fm', accountId: 99, targetType: 'Organization' },
    ]);
    assert.equal(calls[0]?.headers.Authorization, 'Bearer ghu_token');
  });
});
