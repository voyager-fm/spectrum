import type { SetupItem } from '@spectrum/spec-engine/setup';
import { Check, CircleAlert, CircleDashed } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { setOnboardingSkipped } from '../app/onboarding-actions.ts';
import type {
  AgentSetup,
  EvidenceRow,
  Onboarding,
  OnboardingStep,
  StepState,
} from '../lib/onboarding.ts';
import { AgentTabs } from './agent-tabs.tsx';
import { CopyCommand } from './copy-command.tsx';
import { Mono, StatusBadge, type Tone } from './dashboard.tsx';

const STEP_BADGE: Record<StepState, { tone: Tone; label: string }> = {
  done: { tone: 'ok', label: 'Done' },
  todo: { tone: 'planned', label: 'To do' },
  attention: { tone: 'bad', label: 'Needs attention' },
};

const ITEM_LABEL: Record<SetupItem['state'], string> = {
  ok: 'Found',
  missing: 'Missing',
  invalid: 'Invalid',
  unmanaged: 'Not installed by Spectrum',
};

function StepIcon({ state }: { state: StepState }) {
  const Icon = state === 'done' ? Check : state === 'attention' ? CircleAlert : CircleDashed;
  return (
    <span
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border',
        state === 'done' && 'border-primary bg-primary text-primary-foreground',
        state === 'attention' && 'border-destructive text-destructive',
        state === 'todo' && 'border-dashed text-muted-foreground',
      )}
      aria-hidden
    >
      <Icon className="size-3.5" />
    </span>
  );
}

/**
 * Setup checklist for one repository at one commit. Presence of a file is declared setup, not
 * proof that the CLI or an agent integration runs.
 */
export function SetupChecklist({
  onboarding,
  sha,
  sourceUrl,
  skipKey,
}: {
  onboarding: Onboarding;
  sha: string;
  sourceUrl: (path: string) => string;
  /** When set and setup is incomplete, the checklist offers to skip it for this repository. */
  skipKey?: string;
}) {
  return (
    <section aria-labelledby="setup-heading" className="rounded-xl border">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
        <div>
          <h2 id="setup-heading" className="text-sm font-medium">
            {onboarding.complete ? 'Spectrum is set up' : 'Set up Spectrum in this repository'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Read from the files at <Mono>{sha.slice(0, 7)}</Mono>. The App is read-only, so run each
            command in a clone and push the result.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-muted-foreground">
            {onboarding.done} of {onboarding.steps.length} done
          </span>
          {skipKey && !onboarding.complete ? (
            <SkipButton guide={skipKey} skipped>
              Skip for now
            </SkipButton>
          ) : null}
        </div>
      </div>
      <ol className="flex flex-col">
        {onboarding.steps.map((step, index) => (
          <Step key={step.key} step={step} index={index} sourceUrl={sourceUrl} />
        ))}
      </ol>
    </section>
  );
}

function Step({
  step,
  index,
  sourceUrl,
}: {
  step: OnboardingStep;
  index: number;
  sourceUrl: (path: string) => string;
}) {
  const badge = STEP_BADGE[step.state];
  const open = step.state !== 'done';
  return (
    <li className="flex gap-3 border-b px-5 py-4 last:border-b-0">
      <StepIcon state={step.state} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">
            <span className="sr-only">Step {index + 1}: </span>
            {step.title}
          </h3>
          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
        </div>
        <p className="text-sm text-muted-foreground">{step.summary}</p>
        {open && step.commands.length ? (
          <div className="flex max-w-xl flex-col gap-1.5">
            {step.commands.map((command) => (
              <CopyCommand key={command} command={command} />
            ))}
          </div>
        ) : null}
        {open && step.alternative ? (
          <div className="flex max-w-xl flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">{step.alternative.label}</p>
            {step.alternative.commands.map((command) => (
              <CopyCommand key={command} command={command} />
            ))}
          </div>
        ) : null}
        {open && step.note ? <p className="text-xs text-muted-foreground">{step.note}</p> : null}
        {step.agents ? (
          <AgentTabs
            initial={
              (step.agents.find((a) => a.state === 'done') ?? step.agents[0])?.key ?? 'claude'
            }
            tabs={step.agents.map((agent) => ({
              key: agent.key,
              label: agent.label,
              installed: agent.state === 'done',
              panel: <AgentPanel agent={agent} sourceUrl={sourceUrl} />,
            }))}
          />
        ) : null}
        {step.evidence.length > 1 ? <Evidence rows={step.evidence} sourceUrl={sourceUrl} /> : null}
      </div>
    </li>
  );
}

function AgentPanel({
  agent,
  sourceUrl,
}: {
  agent: AgentSetup;
  sourceUrl: (path: string) => string;
}) {
  const badge = STEP_BADGE[agent.state];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={badge.tone}>
          {agent.state === 'done'
            ? 'Installed'
            : agent.state === 'todo'
              ? 'Not installed'
              : badge.label}
        </StatusBadge>
        <p className="text-sm text-muted-foreground">{agent.summary}</p>
      </div>
      {agent.methods.map((method) => (
        <div key={method.label} className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{method.label}</p>
          {method.commands.map((command) => (
            <CopyCommand key={command} command={command} />
          ))}
        </div>
      ))}
      {agent.note ? <p className="text-xs text-muted-foreground">{agent.note}</p> : null}
      <Evidence rows={agent.evidence} sourceUrl={sourceUrl} />
    </>
  );
}

function Evidence({
  rows,
  sourceUrl,
}: {
  rows: EvidenceRow[];
  sourceUrl: (path: string) => string;
}) {
  return (
    <ul className="flex flex-col gap-1 text-xs">
      {rows.map((row) => (
        <li key={row.label} className="flex flex-wrap items-center gap-2">
          <span className="w-full text-muted-foreground sm:w-32">{row.label}</span>
          {row.item.state === 'missing' ? (
            <Mono className="text-muted-foreground">{row.item.path}</Mono>
          ) : (
            <a
              href={sourceUrl(row.item.path)}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline-offset-4 hover:underline"
            >
              {row.item.path}
            </a>
          )}
          <span className={row.item.state === 'ok' ? '' : 'text-muted-foreground'}>
            {ITEM_LABEL[row.item.state]}
            {row.item.detail && row.item.state === 'ok' ? ` · ${row.item.detail}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A form button that skips or restores an onboarding guide in this browser. */
export function SkipButton({
  guide,
  skipped,
  children,
}: {
  guide: string;
  skipped: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={setOnboardingSkipped.bind(null, guide, skipped)}>
      <button type="submit" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        {children}
      </button>
    </form>
  );
}

/** What remains of a skipped checklist: its progress and a way back. */
export function SetupSkipped({ onboarding, skipKey }: { onboarding: Onboarding; skipKey: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-5 py-3">
      <p className="text-sm text-muted-foreground">
        Setup skipped in this browser: {onboarding.done} of {onboarding.steps.length} steps done.
        Checks still run without it.
      </p>
      <SkipButton guide={skipKey} skipped={false}>
        Show setup
      </SkipButton>
    </div>
  );
}
