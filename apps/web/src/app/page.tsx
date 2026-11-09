import type { CheckResult } from '@spectrum/core';
import {
  EmptyNotice,
  LoadErrors,
  Mono,
  PageHead,
  Section,
  StatCard,
  StatusBadge,
} from '../components/dashboard.tsx';
import {
  AcceptancePanel,
  FindingsPanel,
  StatusDistributionPanel,
} from '../components/overview.tsx';
import { loadDashboard } from '../lib/dashboard.ts';
import {
  acceptanceCoverage,
  categoryBreakdown,
  categoryOrder,
  type FindingView,
  groupFindings,
  parseFindingView,
  statusDistribution,
} from '../lib/overview.ts';

type Props = {
  searchParams: Promise<{ group?: string | string[]; severity?: string | string[] }>;
};

const specHref = (spec: { id: string }) => `/specs/${encodeURIComponent(spec.id)}`;

export default async function OverviewPage({ searchParams }: Props) {
  const data = await loadDashboard();
  const { check } = data;
  const categories = new Set(check?.specs.map((s) => s.categoryKey) ?? []).size;
  return (
    <>
      <PageHead
        title="Overview"
        description="Specification health for this repository. Document status is not implementation or test evidence."
      />
      <LoadErrors errors={data.errors} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          {check ? `Across ${categories} categor${categories === 1 ? 'y' : 'ies'}` : 'Not read'}
        </StatCard>
      </div>

      {check ? <OverviewHealth check={check} view={parseFindingView(await searchParams)} /> : null}
    </>
  );
}

function OverviewHealth({ check, view }: { check: CheckResult; view: FindingView }) {
  if (check.specs.length === 0) {
    return (
      <>
        <Section title="Spec health">
          <EmptyNotice>
            No interaction specs were read from the configured feature bundles. Run{' '}
            <Mono>pnpm spec:check</Mono> for details.
          </EmptyNotice>
        </Section>
        <FindingsPanel
          grouped={groupFindings(check.findings, check.specs, view)}
          view={view}
          pagePath="/"
          targetQuery=""
          specHref={specHref}
        />
      </>
    );
  }
  return (
    <>
      <StatusDistributionPanel
        distribution={statusDistribution(check.specs)}
        categories={categoryBreakdown(check.specs, check.findings, categoryOrder(check.model))}
      />
      <AcceptancePanel
        coverage={acceptanceCoverage(check.specs)}
        specCount={check.specs.length}
        hrefFor={specHref}
      />
      <FindingsPanel
        grouped={groupFindings(check.findings, check.specs, view)}
        view={view}
        pagePath="/"
        targetQuery=""
        specHref={specHref}
        emptyNote={
          check.findings.length ? null : <EmptyNotice>No structural findings.</EmptyNotice>
        }
      />
    </>
  );
}
