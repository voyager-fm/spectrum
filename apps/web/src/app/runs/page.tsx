import type { Metadata } from 'next';
import { PageHead, Planned } from '../../components/dashboard.tsx';

export const metadata: Metadata = { title: 'Runs' };

export default function RunsPage() {
  return (
    <>
      <PageHead title="Runs" description="Agent jobs that discover, draft and review specs." />
      <Planned
        title="Agent runs"
        upcoming={[
          'Job kind (discover, draft, review), repository revision and status',
          'Phase progress, budget and bounded repair attempts',
          'Questions and approvals the run is waiting on',
        ]}
      >
        Discovery, drafting and review runs are not available yet. You can still browse specs and
        run local checks.
      </Planned>
    </>
  );
}
