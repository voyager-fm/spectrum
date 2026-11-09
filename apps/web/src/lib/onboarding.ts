import {
  type RepositorySetup,
  SETUP,
  SETUP_COMMANDS,
  type SetupItem,
} from '@spectrum/spec-engine/setup';

/**
 * Onboarding steps for a connected repository, derived from the files at one commit. Spectrum
 * reads through a read-only GitHub App, so each open step offers commands the user runs in a
 * clone; nothing here writes to the repository.
 */

export type StepState = 'done' | 'todo' | 'attention';

export interface EvidenceRow {
  label: string;
  item: SetupItem;
}

export interface OnboardingStep {
  key: 'github' | 'package' | 'config' | 'agent';
  title: string;
  state: StepState;
  /** One sentence on what was found or what is missing. */
  summary: string;
  /** Commands that complete the step, in order. Empty when the step is done. */
  commands: string[];
  /** A second way to complete the step, shown after `commands`. */
  alternative?: { label: string; commands: string[] };
  note?: string;
  evidence: EvidenceRow[];
}

export interface Onboarding {
  steps: OnboardingStep[];
  done: number;
  complete: boolean;
}

/** The CLI package is not on npm yet; say so instead of implying the install command works. */
export const PACKAGE_PUBLISHED = false;

function stateOf(item: SetupItem): StepState {
  if (item.state === 'ok') return 'done';
  if (item.state === 'missing') return 'todo';
  return 'attention';
}

export function onboardingSteps(setup: RepositorySetup): Onboarding {
  const skills = [
    { label: 'Claude Code skill', item: setup.skills.claude },
    { label: 'Codex and OpenCode skill', item: setup.skills.codex },
  ];
  const plugin = { label: 'Claude Code plugin', item: setup.plugin };
  const agentDone = [...skills, plugin].some((row) => row.item.state === 'ok');
  const agentAttention = !agentDone && skills.some((row) => row.item.state === 'unmanaged');

  const packageState = stateOf(setup.package);
  const configState = stateOf(setup.config);

  const steps: OnboardingStep[] = [
    {
      key: 'github',
      title: 'Connect GitHub',
      state: 'done',
      summary: 'The Spectrum Specs Connector can read this repository.',
      commands: [],
      evidence: [],
    },
    {
      key: 'package',
      title: 'Add the Spectrum CLI',
      state: packageState,
      summary:
        packageState === 'done'
          ? `package.json declares ${SETUP.packageName} ${setup.package.detail ?? ''}`.trim()
          : packageState === 'todo'
            ? `package.json does not declare ${SETUP.packageName}.`
            : `package.json could not be read: ${setup.package.detail ?? 'unknown problem'}.`,
      commands: packageState === 'done' ? [] : [SETUP_COMMANDS.install],
      note:
        packageState !== 'done' && !PACKAGE_PUBLISHED
          ? `${SETUP.packageName} is not published to npm yet. Until it is, install a tarball built from the Spectrum repository with pnpm --filter ${SETUP.packageName} pack.`
          : undefined,
      evidence: [{ label: 'package.json', item: setup.package }],
    },
    {
      key: 'config',
      title: 'Create the Spectrum configuration',
      state: configState,
      summary:
        configState === 'done'
          ? `${SETUP.config} is present (${setup.config.detail ?? 'valid'}).`
          : configState === 'todo'
            ? `${SETUP.config} does not exist, so there are no specs to check.`
            : `${SETUP.config} is not usable: ${setup.config.detail ?? 'unknown problem'}.`,
      commands: configState === 'todo' ? [SETUP_COMMANDS.init] : [],
      note:
        configState === 'attention'
          ? 'init refuses to replace an existing configuration. Fix the file, then run the check.'
          : configState === 'todo'
            ? 'init writes the configuration and a starter bundle; add --dry-run to preview.'
            : undefined,
      evidence: [{ label: 'Configuration', item: setup.config }],
    },
    {
      key: 'agent',
      title: 'Connect your coding agent',
      state: agentDone ? 'done' : agentAttention ? 'attention' : 'todo',
      summary: agentDone
        ? 'An agent integration is installed. Repository skills pin the CLI version; the plugin follows the marketplace.'
        : agentAttention
          ? 'A spectrum skill exists but was not installed by Spectrum. Reinstalling with --force replaces it.'
          : 'No Spectrum skill or plugin is installed. Install repository skills, or enable the plugin.',
      commands: agentDone
        ? []
        : [agentAttention ? `${SETUP_COMMANDS.skills} --force` : SETUP_COMMANDS.skills],
      alternative: agentDone
        ? undefined
        : { label: 'Or enable the Claude Code plugin', commands: [...SETUP_COMMANDS.plugin] },
      evidence: [...skills, plugin],
    },
  ];
  const done = steps.filter((step) => step.state === 'done').length;
  return { steps, done, complete: done === steps.length };
}
