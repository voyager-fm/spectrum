import { createSign } from 'node:crypto';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

/** Read-only GitHub App client. It never writes to repositories, comments or check runs. */
export const GITHUB_API = 'https://api.github.com';
/** Web origin for OAuth authorization and code exchange. */
export const GITHUB_WEB = 'https://github.com';

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

/** RS256 App JWT. GitHub accepts at most ten minutes; `iat` is backdated for clock drift. */
export function createAppJwt(appId: string, privateKeyPem: string, now = Date.now()): string {
  const seconds = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({ iat: seconds - 60, exp: seconds + 9 * 60, iss: appId }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${base64url(signer.sign(privateKeyPem))}`;
}

const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'spectrum',
};

/** Error messages name the endpoint and status only; credentials never appear. */
async function request(
  fetcher: Fetch,
  method: string,
  path: string,
  authorization: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(`${GITHUB_API}${path}`, {
      method,
      headers: { ...HEADERS, Authorization: authorization },
      redirect: 'follow',
      // Authenticated responses are never cached (Next.js patches fetch with a data cache).
      cache: 'no-store',
    });
  } catch {
    throw new GitHubError(0, `GitHub request failed: ${method} ${path}`);
  }
  if (!response.ok) {
    // Do not await: a cancelled tee'd body (Next.js fetch) can stay pending forever.
    response.body?.cancel().catch(() => {});
    throw new GitHubError(
      response.status,
      `GitHub returned ${response.status} for ${method} ${path}`,
    );
  }
  return response;
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export interface Installation {
  id: number;
  account: string;
  /** GitHub's numeric id for the account; stable across renames. */
  accountId: number;
  targetType: string;
}

interface RawInstallation {
  id: number;
  target_type: string;
  account: { login: string; id: number } | null;
}

function installation(raw: RawInstallation): Installation {
  return {
    id: raw.id,
    account: raw.account?.login ?? '',
    accountId: raw.account?.id ?? 0,
    targetType: raw.target_type,
  };
}

export interface Repository {
  /** GitHub's numeric id; stable across renames and transfers. */
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

export interface Branch {
  name: string;
  sha: string;
}

export interface PullRequest {
  number: number;
  title: string;
  headRef: string;
  headSha: string;
  htmlUrl: string;
}

interface RawRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  owner: { login: string };
}

function repository(raw: RawRepository): Repository {
  return {
    id: raw.id,
    owner: raw.owner.login,
    name: raw.name,
    fullName: raw.full_name,
    private: raw.private,
    defaultBranch: raw.default_branch,
    htmlUrl: raw.html_url,
  };
}

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

/** Owner and repository names are path segments; reject anything else before a request. */
export function validRepositoryName(owner: string, repo: string): boolean {
  return NAME.test(owner) && NAME.test(repo) && repo !== '.' && repo !== '..';
}

/** Branch, tag or SHA names as Git allows them, without path traversal or control characters. */
export function validRef(ref: string): boolean {
  return (
    ref.length > 0 &&
    ref.length <= 255 &&
    !ref.startsWith('/') &&
    !ref.endsWith('/') &&
    ![...ref].some((c) => c.charCodeAt(0) <= 0x20 || c.charCodeAt(0) === 0x7f) &&
    !/[~^:?*[\\]/.test(ref) &&
    ref.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  );
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

const PAGE = 100;
const MAX_PAGES = 10;

async function paginate<T>(load: (page: number) => Promise<T[]>): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await load(page);
    items.push(...batch);
    if (batch.length < PAGE) break;
  }
  return items;
}

export class GitHubApp {
  readonly appId: string;
  #privateKey: string;
  #fetch: Fetch;
  #now: () => number;
  #tokens = new Map<number, { token: string; expiresAt: number }>();

  constructor(options: { appId: string; privateKey: string; fetch?: Fetch; now?: () => number }) {
    this.appId = options.appId;
    this.#privateKey = options.privateKey;
    this.#fetch = options.fetch ?? fetch;
    this.#now = options.now ?? Date.now;
  }

  #appRequest(method: string, path: string): Promise<Response> {
    const jwt = createAppJwt(this.appId, this.#privateKey, this.#now());
    return request(this.#fetch, method, path, `Bearer ${jwt}`);
  }

  async listInstallations(): Promise<Installation[]> {
    const raw = await paginate(async (page) =>
      json<RawInstallation[]>(
        await this.#appRequest('GET', `/app/installations?per_page=${PAGE}&page=${page}`),
      ),
    );
    return raw.map(installation);
  }

  /** Installation tokens last one hour; reuse them until five minutes before expiry. */
  async installationToken(installationId: number): Promise<string> {
    const cached = this.#tokens.get(installationId);
    if (cached && cached.expiresAt - 5 * 60_000 > this.#now()) return cached.token;
    const body = await json<{ token: string; expires_at: string }>(
      await this.#appRequest('POST', `/app/installations/${installationId}/access_tokens`),
    );
    this.#tokens.set(installationId, {
      token: body.token,
      expiresAt: Date.parse(body.expires_at),
    });
    return body.token;
  }

  async listRepositories(installationId: number): Promise<Repository[]> {
    const token = await this.installationToken(installationId);
    const raw = await paginate(
      async (page) =>
        (
          await json<{ repositories: RawRepository[] }>(
            await request(
              this.#fetch,
              'GET',
              `/installation/repositories?per_page=${PAGE}&page=${page}`,
              `Bearer ${token}`,
            ),
          )
        ).repositories,
    );
    return raw.map(repository);
  }

  /** The installation that covers a repository, or null when the App is not installed there. */
  async repositoryInstallation(owner: string, repo: string): Promise<number | null> {
    try {
      const body = await json<{ id: number }>(
        await this.#appRequest('GET', `/repos/${segment(owner)}/${segment(repo)}/installation`),
      );
      return body.id;
    } catch (error) {
      if (error instanceof GitHubError && error.status === 404) return null;
      throw error;
    }
  }

  async repositoryClient(owner: string, repo: string): Promise<GitHubRepositoryClient | null> {
    if (!validRepositoryName(owner, repo)) throw new GitHubError(400, 'Invalid repository name');
    const installationId = await this.repositoryInstallation(owner, repo);
    if (installationId === null) return null;
    return this.installationClient(owner, repo, installationId);
  }

  /** A client for a repository through a known installation, after the caller checked access. */
  async installationClient(
    owner: string,
    repo: string,
    installationId: number,
  ): Promise<GitHubRepositoryClient> {
    if (!validRepositoryName(owner, repo)) throw new GitHubError(400, 'Invalid repository name');
    return new GitHubRepositoryClient({
      owner,
      repo,
      token: await this.installationToken(installationId),
      fetch: this.#fetch,
    });
  }
}

export class GitHubRepositoryClient {
  readonly owner: string;
  readonly repo: string;
  #token: string;
  #fetch: Fetch;

  constructor(options: { owner: string; repo: string; token: string; fetch?: Fetch }) {
    this.owner = options.owner;
    this.repo = options.repo;
    this.#token = options.token;
    this.#fetch = options.fetch ?? fetch;
  }

  #get(path: string): Promise<Response> {
    return request(
      this.#fetch,
      'GET',
      `/repos/${segment(this.owner)}/${segment(this.repo)}${path}`,
      `Bearer ${this.#token}`,
    );
  }

  async getRepository(): Promise<Repository> {
    return repository(await json<RawRepository>(await this.#get('')));
  }

  async listBranches(): Promise<Branch[]> {
    const raw = await paginate(async (page) =>
      json<{ name: string; commit: { sha: string } }[]>(
        await this.#get(`/branches?per_page=${PAGE}&page=${page}`),
      ),
    );
    return raw.map((b) => ({ name: b.name, sha: b.commit.sha }));
  }

  async listOpenPullRequests(): Promise<PullRequest[]> {
    const raw = await paginate(async (page) =>
      json<
        { number: number; title: string; html_url: string; head: { ref: string; sha: string } }[]
      >(await this.#get(`/pulls?state=open&per_page=${PAGE}&page=${page}`)),
    );
    return raw.map(pullRequest);
  }

  async getPullRequest(number: number): Promise<PullRequest> {
    return pullRequest(
      await json<{
        number: number;
        title: string;
        html_url: string;
        head: { ref: string; sha: string };
      }>(await this.#get(`/pulls/${number}`)),
    );
  }

  /** Pin a branch, tag or SHA to the commit it names right now. */
  async resolveCommit(ref: string): Promise<string> {
    if (!validRef(ref)) throw new GitHubError(400, 'Invalid Git ref');
    const path = ref.split('/').map(segment).join('/');
    const body = await json<{ sha: string }>(await this.#get(`/commits/${path}`));
    return body.sha;
  }

  /** gzip tarball of the repository at exactly this commit. */
  async downloadTarball(sha: string): Promise<Readable> {
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new GitHubError(400, 'Tarball needs a full commit SHA');
    const response = await this.#get(`/tarball/${sha}`);
    if (!response.body) throw new GitHubError(response.status, 'GitHub returned an empty tarball');
    return Readable.fromWeb(response.body as WebReadableStream<Uint8Array>);
  }
}

function pullRequest(raw: {
  number: number;
  title: string;
  html_url: string;
  head: { ref: string; sha: string };
}): PullRequest {
  return {
    number: raw.number,
    title: raw.title,
    headRef: raw.head.ref,
    headSha: raw.head.sha,
    htmlUrl: raw.html_url,
  };
}

/** The GitHub account that signed in through the App's user authorization. */
export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string;
}

/** Authorization URL for the App's user-to-server OAuth flow. The App's permissions apply. */
export function oauthAuthorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const query = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    state: options.state,
    allow_signup: 'false',
  });
  return `${GITHUB_WEB}/login/oauth/authorize?${query}`;
}

/**
 * Exchange an OAuth code for a user access token. The token is returned to the caller only;
 * error messages never contain the code, the secret or the token.
 */
export async function exchangeOAuthCode(options: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  fetch?: Fetch;
}): Promise<string> {
  const fetcher = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetcher(`${GITHUB_WEB}/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': HEADERS['User-Agent'],
      },
      body: JSON.stringify({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        code: options.code,
        redirect_uri: options.redirectUri,
      }),
      cache: 'no-store',
    });
  } catch {
    throw new GitHubError(0, 'GitHub request failed: POST /login/oauth/access_token');
  }
  if (!response.ok) {
    response.body?.cancel().catch(() => {});
    throw new GitHubError(response.status, `GitHub returned ${response.status} for OAuth exchange`);
  }
  // GitHub reports a bad or expired code with 200 and an `error` field.
  const body = (await response.json()) as { access_token?: string; error?: string };
  if (!body.access_token) {
    throw new GitHubError(401, `GitHub rejected the OAuth code (${body.error ?? 'no token'})`);
  }
  return body.access_token;
}

/** Calls made as the signed-in user, bounded by what both the user and the App can access. */
export class GitHubUserClient {
  #token: string;
  #fetch: Fetch;

  constructor(options: { token: string; fetch?: Fetch }) {
    this.#token = options.token;
    this.#fetch = options.fetch ?? fetch;
  }

  #get(path: string): Promise<Response> {
    return request(this.#fetch, 'GET', path, `Bearer ${this.#token}`);
  }

  async getUser(): Promise<GitHubUser> {
    const raw = await json<{ id: number; login: string; name: string | null; avatar_url: string }>(
      await this.#get('/user'),
    );
    return { id: raw.id, login: raw.login, name: raw.name, avatarUrl: raw.avatar_url };
  }

  /** Installations of this App that the user can access, as GitHub decides. */
  async listInstallations(): Promise<Installation[]> {
    const raw = await paginate(
      async (page) =>
        (
          await json<{ installations: RawInstallation[] }>(
            await this.#get(`/user/installations?per_page=${PAGE}&page=${page}`),
          )
        ).installations,
    );
    return raw.map(installation);
  }
}
