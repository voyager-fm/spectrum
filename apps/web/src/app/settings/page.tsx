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
  return (
    <>
      <PageHead
        title="Integrations"
        description={
          <>
            Connection state comes from the server environment and the connected service, never from{' '}
            <Mono>.spectrum/config.json</Mono>. Connecting or editing integrations from the
            dashboard is not supported yet.
          </>
        }
      />
      <LoadErrors errors={data.errors} />
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Integration</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Purpose</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">GitHub</TableCell>
              <TableCell>
                <Link href="/repositories" className="underline-offset-4 hover:underline">
                  <StatusBadge tone={github.configured ? 'info' : 'neutral'}>
                    {github.configured ? 'App configured' : 'Not configured'}
                  </StatusBadge>
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal text-muted-foreground">
                Read-only repository checks through the GitHub App
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Linear</TableCell>
              <TableCell>
                <StatusBadge tone="planned">Not implemented</StatusBadge>
              </TableCell>
              <TableCell className="whitespace-normal text-muted-foreground">
                Links between requirements and issues
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <Section title="Model provider">
        <div className="rounded-xl border border-dashed p-6">
          <StatusBadge>None configured</StatusBadge>
          <p className="mt-2 text-sm text-muted-foreground">
            Service models, BYOK and subscription connections each need a verified authentication
            path. None is supported yet, so discovery, drafting and review jobs cannot run. Secrets
            never belong in <Mono>.spectrum/</Mono>.
          </p>
        </div>
      </Section>
    </>
  );
}
