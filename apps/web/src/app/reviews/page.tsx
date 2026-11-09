import type { Metadata } from 'next';
import { Mono, PageHead, Planned } from '../../components/dashboard.tsx';

export const metadata: Metadata = { title: 'PR reviews' };

export default function ReviewsPage() {
  return (
    <>
      <PageHead title="PR reviews" description="Pull request reviews against the specs and rules they affect." />
      <Planned
        title="Spec-aware pull request review"
        upcoming={[
          'Pull requests with the head SHA each review was run against',
          'Missing behavior, conflicts and acceptance-criteria gaps per affected spec',
          'Results from external reviewers when an integration is connected',
          'Spec improvements proposed from review findings',
        ]}
      >
        No GitHub App or webhook is connected. A review result must match the current head SHA before it can mark a pull
        request as reviewed.
      </Planned>
    </>
  );
}
