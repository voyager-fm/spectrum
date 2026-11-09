import { Mono } from './dashboard.tsx';

const PERMISSIONS = [
  ['Contents', 'Read-only'],
  ['Metadata', 'Read-only'],
  ['Pull requests', 'Read-only'],
] as const;

/** Setup steps shown while this server has no GitHub App credentials. Lists names, never values. */
export function GitHubSetup({ missing }: { missing: string[] }) {
  return (
    <section aria-labelledby="github-setup" className="rounded-xl border p-6">
      <h2 id="github-setup" className="text-sm font-medium">
        Connect a GitHub App
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This server has no GitHub App credentials, so it cannot read any repository yet.
      </p>
      <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-sm">
        <li>
          Register a GitHub App with these repository permissions and no webhook:
          <ul className="mt-2 flex flex-col gap-1">
            {PERMISSIONS.map(([name, level]) => (
              <li key={name} className="flex gap-2">
                <span className="w-28">{name}</span>
                <span className="text-muted-foreground">{level}</span>
              </li>
            ))}
          </ul>
        </li>
        <li>
          Set the Setup URL to <Mono>/api/github/setup</Mono> on this server so GitHub returns here
          after installation.
        </li>
        <li>
          Generate a private key and set <Mono>GITHUB_APP_ID</Mono>, <Mono>GITHUB_APP_SLUG</Mono>{' '}
          and <Mono>GITHUB_APP_PRIVATE_KEY_PATH</Mono> (or <Mono>GITHUB_APP_PRIVATE_KEY</Mono>) in
          the server environment, for example <Mono>apps/web/.env.local</Mono>. Never commit the key
          or put it in <Mono>.spectrum/</Mono>.
        </li>
        <li>Restart the server, then install the App on the repositories to check.</li>
      </ol>
      {missing.length ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Missing:{' '}
          {missing.map((name, i) => (
            <span key={name}>
              {i ? ', ' : ''}
              <Mono>{name}</Mono>
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}
