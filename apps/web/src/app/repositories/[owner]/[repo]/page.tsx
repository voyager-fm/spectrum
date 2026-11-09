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
  AcceptancePanel,
  CheckTrendPanel,
  FindingsPanel,
  StatusDistributionPanel,
} from '../../../../components/overview.tsx';
import {
  RepositoryFrame,
  repositoryPath,
  targetQuery,
} from '../../../../components/repository.tsx';
import { SetupChecklist } from '../../../../components/setup.tsx';
import type { CheckHistoryRow } from '../../../../db/store.ts';
import {
  type CheckTarget,
  loadRepositoryCheck,
  parseTarget,
  type RemoteCheck,
  type RepositoryView,
} from '../../../../lib/github.ts';
import { onboardingSteps } from '../../../../lib/onboarding.ts';
import {
  acceptanceCoverage,
  categoryBreakdown,
  categoryOrder,
  checkTrend,
  type FindingView,
  groupFindings,
  parseFindingView,
  statusDistribution,
} from '../../../../lib/overview.ts';

type Props = {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{
    ref?: string | string[];
    pr?: string | string[];
    group?: string | string[];
    severity?: string | string[];
  }>;
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
  const query = await searchParams;
  const target = parseTarget(query);
  const findingView = parseFindingView(query);
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
      {view.status === 'ready' ? (
        <Ready view={view} base={base} target={target} findingView={findingView} />
      ) : null}
    </RepositoryFrame>
  );
}

function Ready({
  view,
  base,
  target,
  findingView,
}: {
  view: Extract<RepositoryView, { status: 'ready' }>;
  base: string;
  target: ReturnType<typeof parseTarget>;
  findingView: FindingView;
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
          <CheckSummary
            check={check}
            htmlUrl={repository.htmlUrl}
            base={base}
            findingView={findingView}
          />
          {onboarding.complete ? (
            <Section title="Setup">
              <SetupChecklist onboarding={onboarding} sha={check.sha} sourceUrl={source} />
            </Section>
          ) : null}
        </>
      ) : (
        <EmptyNotice>Not assessed. No check result exists for this revision.</EmptyNotice>
      )}

      {check ? (
        <CheckTrendPanel
          rows={view.history ? checkTrend(view.history) : null}
          currentSha={check.sha}
          hrefFor={(sha) => `${base}?ref=${sha}`}
        />
      ) : null}
      {view.history ? <History rows={view.history} base={base} current={check?.sha} /> : null}

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
  findingView,
}: {
  check: RemoteCheck;
  htmlUrl: string;
  base: string;
  findingView: FindingView;
}) {
  const { result } = check;
  const query = targetQuery(check.target);
  const specHref = (spec: { id: string }) => `${base}/specs/${encodeURIComponent(spec.id)}${query}`;
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

      {result.specs.length ? (
        <>
          <StatusDistributionPanel
            distribution={statusDistribution(result.specs)}
            categories={categoryBreakdown(
              result.specs,
              result.findings,
              categoryOrder(result.model),
            )}
          />
          <AcceptancePanel
            coverage={acceptanceCoverage(result.specs)}
            specCount={result.specs.length}
            hrefFor={specHref}
          />
        </>
      ) : null}

      <FindingsPanel
        grouped={groupFindings(result.findings, result.specs, findingView)}
        view={findingView}
        pagePath={base}
        targetQuery={query}
        specHref={specHref}
        sourceUrl={(path, line) => `${htmlUrl}/blob/${check.sha}/${path}${line ? `#L${line}` : ''}`}
        emptyNote={
          noConfig ? (
            <EmptyNotice>
              This commit has no readable <Mono>.spectrum/config.json</Mono>, so there are no specs
              to check. Follow the setup steps above to add one.
            </EmptyNotice>
          ) : result.findings.length ? null : (
            <EmptyNotice>
              No structural findings at <Mono>{short(check.sha)}</Mono>.
            </EmptyNotice>
          )
        }
      />
    </>
  );
}

function History({
  rows,
  base,
  current,
}: {
  rows: CheckHistoryRow[];
  base: string;
  current: string | undefined;
}) {
  return (
    <Section
      title="Check history"
      description="Every commit checked in this workspace, newest first. A commit is analyzed once and reused."
    >
      {rows.length ? (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Commit</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead className="w-24">Result</TableHead>
                <TableHead className="text-right">Findings</TableHead>
                <TableHead className="text-right">Specs</TableHead>
                <TableHead>Checked</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.sha}>
                  <TableCell>
                    {row.sha === current ? (
                      <Mono>{short(row.sha)}</Mono>
                    ) : (
                      <Link
                        href={`${base}?ref=${row.sha}`}
                        className="font-mono text-xs underline-offset-4 hover:underline"
                      >
                        {short(row.sha)}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    <Mono>{row.ref}</Mono>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={row.ok ? 'ok' : 'bad'}>
                      {row.ok ? 'Passed' : 'Failed'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.errors + row.warnings}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.specs}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <time dateTime={row.analyzedAt}>
                      {row.analyzedAt.replace('T', ' ').slice(0, 16)} UTC
                    </time>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.triggeredBy ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyNotice>No checks are stored yet.</EmptyNotice>
      )}
    </Section>
  );
}
