import type { Metadata } from 'next';
import { Mono, PageHead, Planned } from '../../components/dashboard.tsx';

export const metadata: Metadata = { title: 'Proposals' };

export default function ProposalsPage() {
  return (
    <>
      <PageHead title="Proposals" description="Review spec change sets before anything is written to the repository." />
      <Planned
        title="Change set review"
        upcoming={[
          'Proposed edits with base revision, file hashes and affected specs',
          'Findings and evidence behind each change',
          'Approval bound to the exact content digest, actor and time',
          'Stale state when the repository revision changes during review',
        ]}
      >
        No proposal store or generator exists yet. The ChangeSet contract is in <Mono>.spectrum/contracts/change-set.md</Mono>.
      </Planned>
    </>
  );
}
