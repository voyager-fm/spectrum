import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  EmptyNotice,
  LoadErrors,
  Mono,
  Section,
  StatCard,
  StatusBadge,
} from '../../../../components/dashboard.tsx';
import {
  RepositoryFrame,
  repositoryPath,
  targetQuery,
} from '../../../../components/repository.tsx';
import { SetupChecklist } from '../../../../components/setup.tsx';
import {
  type CheckTarget,
  loadRepositoryCheck,
  parseTarget,
  type RemoteCheck,
  type RepositoryView,
} from '../../../../lib/github.ts';
import { onboardingSteps } from '../../../../lib/onboarding.ts';

type Props = {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ ref?: string | string[]; pr?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `${decodeURIComponent(owner)}/${decodeURIComponent(repo)}` };
}

const MAX_BRANCHES = 30;

function short(sha: string) {
  return sha.slice(0, 7);
}

function sameTarget(a: CheckTarget | undefined, b: CheckTarget) {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === 'ref' && b.kind === 'ref') return a.ref === b.ref;
  if (a.kind === 'pr' && b.kind === 'pr') return a.number === b.number;
  return true;
}

export default async function RepositoryPage({ params, searchParams }: Props) {
  const { owner: rawOwner, repo: rawRepo } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  const target = parseTarget(await searchParams);
  const view = await loadRepositoryCheck(owner, repo, target);
  const base = repositoryPath(owner, repo);

  return (
    <RepositoryFrame
      owner={owner}
      repo={repo}
      view={view}
      tab="overview"
      query={targetQuery(target)}
    >
      {view.status === 'ready' ? <Ready view={view} base={base} target={target} /> : null}
    </RepositoryFrame>
  );
}

function Ready({
  view,
  base,
  target,
}: {
  view: Extract<RepositoryView, { status: 'ready' }>;
  base: string;
  target: ReturnType<typeof parseTarget>;
}) {
  const { repository, branches, pullRequests, check } = view;
  const source = (path: string) => `${repository.htmlUrl}/blob/${check?.sha}/${path}`;
  const onboarding = check ? onboardingSteps(check.setup) : null;
  return (
    <>
      <LoadErrors errors={view.errors} />
      {check && onboarding ? (
        <>
          {onboarding.complete ? null : (
            <div className="mb-10">
              <SetupChecklist onboarding={onboarding} sha={check.sha} sourceUrl={source} />
            </div>
          )}
          <CheckSummary check={check} htmlUrl={repository.htmlUrl} base={base} />
          {onboarding.complete ? (
            <Section title="Setup">
              <SetupChecklist onboarding={onboarding} sha={check.sha} sourceUrl={source} />
            </Section>
          ) : null}
        </>
      ) : (
        <EmptyNotice>Not assessed. No check result exists for this revision.</EmptyNotice>
      )}

      <Section
        title="Revision"
        description="Each check downloads the repository at the commit a ref points to right now."
      >
        <form action={base} method="get" className="flex max-w-md gap-2">
          <label htmlFor="ref" className="sr-only">
            Branch, tag or SHA
          </label>
          <Input
            id="ref"
            name="ref"
            placeholder="branch, tag or SHA"
            defaultValue={target.kind === 'ref' ? target.ref : ''}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          <button type="submit" className={buttonVariants({ variant: 'outline' })}>
            Check
          </button>
        </form>
      </Section>

      <Section title="Open pull requests" description="Checked at the pull request head commit.">
        {pullRequests.length ? (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">PR</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Head</TableHead>
                  <TableHead className="w-24">Head SHA</TableHead>
                  <TableHead className="w-24 text-right">Check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pullRequests.map((pr) => (
                  <TableRow key={pr.number}>
                    <TableCell>
                      <Mono>#{pr.number}</Mono>
                    </TableCell>
                    <TableCell className="whitespace-normal">{pr.title}</TableCell>
                    <TableCell>
                      <Mono>{pr.headRef}</Mono>
                    </TableCell>
                    <TableCell>
                      <Mono>{short(pr.headSha)}</Mono>
                    </TableCell>
                    <TableCell className="text-right">
                      <TargetLink
                        href={`${base}?pr=${pr.number}`}
                        current={sameTarget(check?.target, { kind: 'pr', number: pr.number })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyNotice>No open pull requests.</EmptyNotice>
        )}
      </Section>

      <Section
        title="Branches"
        description={
          branches.length > MAX_BRANCHES
            ? `First ${MAX_BRANCHES} of ${branches.length}. Enter any other ref above.`
            : undefined
        }
      >
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead className="w-24">SHA</TableHead>
                <TableHead className="w-24 text-right">Check</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.slice(0, MAX_BRANCHES).map((b) => {
                const isDefault = b.name === repository.defaultBranch;
                const t: CheckTarget = isDefault
                  ? { kind: 'default' }
                  : { kind: 'ref', ref: b.name };
                return (
                  <TableRow key={b.name}>
                    <TableCell>
                      <Mono>{b.name}</Mono>
                      {isDefault ? (
                        <span className="ml-2">
                          <StatusBadge tone="info">default</StatusBadge>
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Mono>{short(b.sha)}</Mono>
                    </TableCell>
                    <TableCell className="text-right">
                      <TargetLink
                        href={isDefault ? base : `${base}?ref=${encodeURIComponent(b.name)}`}
                        current={
                          sameTarget(check?.target, t) ||
                          (isDefault && check?.target.kind === 'ref' && check.target.ref === b.name)
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Section>
    </>
  );
}

function TargetLink({ href, current }: { href: string; current: boolean }) {
  if (current) return <StatusBadge tone="info">Shown</StatusBadge>;
  return (
    <Link href={href} className="text-sm underline-offset-4 hover:underline">
      Check
    </Link>
  );
}

function CheckSummary({
  check,
  htmlUrl,
  base,
}: {
  check: RemoteCheck;
  htmlUrl: string;
  base: string;
}) {
  const { result } = check;
  const errors = result.findings.filter((f) => f.severity === 'error').length;
  const warnings = result.findings.length - errors;
  const noConfig =
    result.specs.length === 0 &&
    result.findings.some((f) => f.code === 'invalid-config' && f.path === '.spectrum/config.json');
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Result"
          value={
            <StatusBadge tone={result.ok ? 'ok' : 'bad'}>
              {result.ok ? 'Passed' : 'Failed'}
            </StatusBadge>
          }
        >
          Structure only
        </StatCard>
        <StatCard
          title="Commit"
          value={
            <a
              href={`${htmlUrl}/commit/${check.sha}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xl underline-offset-4 hover:underline"
            >
              {short(check.sha)}
            </a>
          }
        >
          <Mono>{check.ref}</Mono>
        </StatCard>
        <StatCard title="Findings" value={result.findings.length}>
          {errors} errors, {warnings} warnings
        </StatCard>
        <StatCard
          title="Specs read"
          value={
            result.specs.length ? (
              <Link
                href={`${base}/specs${targetQuery(check.target)}`}
                className="underline-offset-4 hover:underline"
              >
                {result.specs.length}
              </Link>
            ) : (
              0
            )
          }
        >
          Checked{' '}
          <time dateTime={check.checkedAt}>
            {check.checkedAt.replace('T', ' ').slice(0, 19)} UTC
          </time>
        </StatCard>
      </div>

      <Section title="Findings">
        {noConfig ? (
          <EmptyNotice>
            This commit has no readable <Mono>.spectrum/config.json</Mono>, so there are no specs to
            check. Follow the setup steps above to add one.
          </EmptyNotice>
        ) : null}
        {result.findings.length ? (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.findings.map((f) => (
                  <TableRow key={`${f.code}:${f.path}:${f.line ?? ''}:${f.message}`}>
                    <TableCell>
                      <StatusBadge tone={f.severity === 'error' ? 'bad' : 'neutral'}>
                        {f.severity}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <Mono>{f.code}</Mono>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`${htmlUrl}/blob/${check.sha}/${f.path}${f.line ? `#L${f.line}` : ''}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs underline-offset-4 hover:underline"
                      >
                        {f.path}
                        {f.line ? `:${f.line}` : ''}
                      </a>
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {f.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyNotice>
            No structural findings at <Mono>{short(check.sha)}</Mono>. This does not show that the
            code implements the specs.
          </EmptyNotice>
        )}
      </Section>
    </>
  );
}
