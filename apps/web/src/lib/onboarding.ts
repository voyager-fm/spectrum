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
  /** Per-agent setup, shown as tabs. Only the agent step has it. */
  agents?: AgentSetup[];
}

export type AgentKey = 'claude' | 'codex' | 'opencode';

/** How one coding agent picks up Spectrum in this repository. */
export interface AgentSetup {
  key: AgentKey;
  label: string;
  /** done: installed for this agent; attention: a skill exists that Spectrum did not install. */
  state: StepState;
  summary: string;
  /** Ways to install, in order of preference. Empty when installed. */
  methods: { label: string; commands: string[] }[];
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

function skillCommand(agent: 'claude' | 'codex', item: SetupItem): string {
  const command = `${SETUP_COMMANDS.skills} --agent ${agent}`;
  return item.state === 'unmanaged' ? `${command} --force` : command;
}

function skillSummary(item: SetupItem, name: string): string {
  if (item.state === 'ok')
    return `The repository skill is installed${item.detail ? ` (${item.detail})` : ''}; it runs the CLI version the repository pins.`;
  if (item.state === 'unmanaged')
    return `A spectrum skill exists but was not installed by Spectrum. Reinstalling with --force replaces it.`;
  if (item.state === 'invalid')
    return `The skill file could not be read: ${item.detail ?? 'unknown problem'}.`;
  return `No Spectrum skill is installed for ${name}.`;
}

/** Claude Code, Codex and OpenCode, each with the files it reads and the commands that install them. */
export function agentSetups(setup: RepositorySetup): AgentSetup[] {
  const claudeSkill = { label: 'Repository skill', item: setup.skills.claude };
  const plugin = { label: 'Plugin', item: setup.plugin };
  const sharedSkill = { label: 'Repository skill', item: setup.skills.codex };
  const claudeDone = claudeSkill.item.state === 'ok' || plugin.item.state === 'ok';
  const shared = (key: 'codex' | 'opencode', label: string, other: string): AgentSetup => ({
    key,
    label,
    state: stateOf(sharedSkill.item),
    summary: skillSummary(sharedSkill.item, label),
    methods:
      sharedSkill.item.state === 'ok'
        ? []
        : [
            {
              label: 'Install the repository skill',
              commands: [skillCommand('codex', sharedSkill.item)],
            },
          ],
    note: `${label} and ${other} read the same file, so one install covers both.`,
    evidence: [sharedSkill],
  });
  return [
    {
      key: 'claude',
      label: 'Claude Code',
      state: claudeDone ? 'done' : stateOf(claudeSkill.item),
      summary: claudeDone
        ? plugin.item.state === 'ok' && claudeSkill.item.state !== 'ok'
          ? 'The Spectrum plugin is enabled; it follows the marketplace version.'
          : skillSummary(claudeSkill.item, 'Claude Code')
        : skillSummary(claudeSkill.item, 'Claude Code'),
      methods: claudeDone
        ? []
        : [
            {
              label: 'Install the repository skill',
              commands: [skillCommand('claude', claudeSkill.item)],
            },
            { label: 'Or enable the plugin', commands: [...SETUP_COMMANDS.plugin] },
          ],
      evidence: [claudeSkill, plugin],
    },
    shared('codex', 'Codex', 'OpenCode'),
    shared('opencode', 'OpenCode', 'Codex'),
  ];
}

export function onboardingSteps(setup: RepositorySetup): Onboarding {
  const agents = agentSetups(setup);
  const installed = agents.filter((agent) => agent.state === 'done');
  const agentDone = installed.length > 0;
  const agentAttention = !agentDone && agents.some((agent) => agent.state === 'attention');

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
        ? `Installed for ${installed.map((agent) => agent.label).join(', ')}. Choose another agent to add it.`
        : agentAttention
          ? 'A spectrum skill exists but was not installed by Spectrum. Choose the agent to reinstall it for.'
          : 'No Spectrum skill or plugin is installed. Choose the agent you use.',
      commands: [],
      evidence: [],
      agents,
    },
  ];
  const done = steps.filter((step) => step.state === 'done').length;
  return { steps, done, complete: done === steps.length };
}
