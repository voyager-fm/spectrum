import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LoadErrors,
  Mono,
  PageHead,
  Section,
  StatCard,
  StatusBadge,
} from '../components/dashboard.tsx';
import { loadDashboard } from '../lib/dashboard.ts';
import { githubAppStatus } from '../lib/github.ts';

const loop = [
  { href: '/proposals', title: 'Proposals', detail: 'Spec change sets awaiting review' },
  { href: '/runs', title: 'Runs', detail: 'Discover, draft and review jobs' },
  { href: '/reviews', title: 'PR reviews', detail: 'Pull requests checked against specs' },
];

export default async function OverviewPage() {
  const [data, github] = await Promise.all([loadDashboard(), githubAppStatus()]);
  const { check, config } = data;
  const approved = check?.specs.filter((s) => s.status === 'approved').length ?? 0;
  return (
    <>
      <PageHead
        title="Overview"
        description="Specification health for this repository. Document status is not implementation or test evidence."
      />
      <LoadErrors errors={data.errors} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Spec check"
          value={
            check ? (
              <StatusBadge tone={check.ok ? 'ok' : 'bad'}>
                {check.ok ? 'Passed' : 'Failed'}
              </StatusBadge>
            ) : (
              <StatusBadge tone="bad">Could not run</StatusBadge>
            )
          }
        >
          {check
            ? `${check.findings.length} finding${check.findings.length === 1 ? '' : 's'} · deterministic, no model`
            : 'See the error above'}
        </StatCard>
        <StatCard title="Interaction specs" value={check?.specs.length ?? '—'}>
          {approved} marked approved · document review only
        </StatCard>
        <StatCard title="Rules" value={data.rules.length}>
          files in <Mono>.spectrum/rules</Mono>
        </StatCard>
        <StatCard
          title="Mode"
          value={<StatusBadge tone="info">{config?.mode ?? 'unknown'}</StatusBadge>}
        >
          Canonical source: {config?.canonicalSource ?? 'unknown'}
        </StatCard>
      </div>

      {check && check.findings.length > 0 ? (
        <Section title="Findings">
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {check.findings.map((f, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Findings have no IDs and can repeat; this read-only list is server-rendered.
                  <TableRow key={`${f.path}-${f.code}-${i}`}>
                    <TableCell>
                      <StatusBadge tone="bad">{f.code}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <Mono>{f.path}</Mono>
                    </TableCell>
                    <TableCell className="whitespace-normal">{f.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      ) : null}

      <Section title="Agent loop" description="Planned capabilities. Nothing here runs yet.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loop.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card size="sm" className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {item.title}
                    <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
                  </CardTitle>
                  <CardDescription>{item.detail}</CardDescription>
                  <div>
                    <StatusBadge tone="planned">Not implemented</StatusBadge>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
          <Link
            href="/settings"
            className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card size="sm" className="h-full transition-colors group-hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Integrations
                  <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
                </CardTitle>
                <CardDescription>
                  GitHub App {github.configured ? 'configured' : 'not configured'} · Linear not
                  implemented
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </Section>
    </>
  );
}
