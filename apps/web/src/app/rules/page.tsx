import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  EmptyNotice,
  LoadErrors,
  PageHead,
  Planned,
  StatusBadge,
} from '../../components/dashboard.tsx';
import { loadDashboard } from '../../lib/dashboard.ts';

export const metadata: Metadata = { title: 'Rules' };

export default async function RulesPage() {
  const data = await loadDashboard();
  return (
    <>
      <PageHead
        title="Rules"
        description="Repository rules from the configured sources. Installation and review application require separate evidence."
      />
      <LoadErrors errors={data.errors} />

      <div className="flex flex-col gap-3">
        {data.rules.length === 0 ? (
          <EmptyNotice>No rule files loaded from the configured sources.</EmptyNotice>
        ) : (
          data.rules.map((rule) => (
            <Card key={rule.path}>
              <CardHeader>
                <CardTitle>{rule.title}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span className="font-mono text-xs">{rule.path}</span>
                  <StatusBadge tone="info">In repository</StatusBadge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre>{rule.body}</pre>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="mt-10">
        <Planned
          title="Rule proposals"
          upcoming={[
            'Read existing agent and review rules (AGENTS.md, CLAUDE.md, review tool configs)',
            'Propose improvements as a reviewable change set',
            'Show where each approved rule is installed and its baseline revision',
          ]}
        >
          Spectrum reads the configured rule roots. Automatic discovery, rule proposals and
          installation are planned.
        </Planned>
      </div>
    </>
  );
}
