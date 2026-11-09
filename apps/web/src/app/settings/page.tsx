import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadErrors, Mono, PageHead, Section, StatusBadge } from '../../components/dashboard.tsx';
import { loadDashboard } from '../../lib/dashboard.ts';
import { githubAppStatus } from '../../lib/github.ts';

export const metadata: Metadata = { title: 'Integrations' };

export default async function SettingsPage() {
  const [data, github] = await Promise.all([loadDashboard(), githubAppStatus()]);
  const config = data.config;
  const rows = [
    {
      name: 'GitHub',
      configured: config?.github,
      detail: 'Read-only repository checks through the GitHub App',
      connection: github.configured ? ('app' as const) : ('missing' as const),
    },
    { name: 'Linear', configured: config?.linear, detail: 'Links between requirements and issues' },
    { name: 'Agents', configured: config?.agents, detail: 'Discovery, drafting and review jobs' },
  ];
  return (
    <>
      <PageHead
        title="Integrations"
        description={
          <>
            Read from <Mono>.spectrum/config.json</Mono>. Editing settings from the dashboard is not
            supported.
          </>
        }
      />
      <LoadErrors errors={data.errors} />
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Integration</TableHead>
              <TableHead>Config flag</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Purpose</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <StatusBadge tone={r.configured ? 'info' : 'neutral'}>
                    {r.configured ? 'enabled' : 'disabled'}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  {'connection' in r ? (
                    <Link href="/repositories" className="underline-offset-4 hover:underline">
                      <StatusBadge tone={r.connection === 'app' ? 'info' : 'neutral'}>
                        {r.connection === 'app' ? 'App configured' : 'Not configured'}
                      </StatusBadge>
                    </Link>
                  ) : (
                    <StatusBadge tone="planned">Not implemented</StatusBadge>
                  )}
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  {r.detail}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Section title="Model provider">
        <div className="rounded-xl border border-dashed p-6">
          <StatusBadge>None configured</StatusBadge>
          <p className="mt-2 text-sm text-muted-foreground">
            Service models, BYOK and subscription connections each need a verified authentication
            path. None is supported yet. Secrets never belong in <Mono>.spectrum/</Mono>.
          </p>
        </div>
      </Section>
    </>
  );
}
