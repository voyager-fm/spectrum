import type { Metadata } from 'next';
import { Mono, PageHead, Planned } from '../../components/dashboard.tsx';

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
        The worker has no queue or model provider yet; <Mono>runJob</Mono> throws a not-implemented
        error.
      </Planned>
    </>
  );
}
