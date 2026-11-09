import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RepositorySetup, SetupItem } from '@spectrum/spec-engine/setup';
import { onboardingSteps } from './onboarding.ts';

const item = (
  state: SetupItem['state'],
  path: string,
  detail: string | null = null,
): SetupItem => ({
  state,
  path,
  detail,
});

function setup(overrides: Partial<RepositorySetup> = {}): RepositorySetup {
  return {
    config: item('missing', '.spectrum/config.json'),
    package: item('missing', 'package.json', '@voyager-fm/spectrum is not declared'),
    skills: {
      claude: item('missing', '.claude/skills/spectrum/SKILL.md'),
      codex: item('missing', '.agents/skills/spectrum/SKILL.md'),
    },
    plugin: item('missing', '.claude/settings.json'),
    ...overrides,
  };
}

const step = (s: RepositorySetup, key: string) => {
  const found = onboardingSteps(s).steps.find((x) => x.key === key);
  assert.ok(found, key);
  return found;
};

describe('onboardingSteps', () => {
  it('offers the CLI commands for a repository with nothing installed', () => {
    const result = onboardingSteps(setup());
    assert.equal(result.done, 1, 'only the GitHub connection is done');
    assert.equal(result.complete, false);
    assert.deepEqual(step(setup(), 'package').commands, [
      'npm install --save-dev @voyager-fm/spectrum',
    ]);
    assert.match(step(setup(), 'package').note ?? '', /not published to npm yet/);
    assert.deepEqual(step(setup(), 'config').commands, ['npx --no spectrum init']);
    const agents = step(setup(), 'agent').agents ?? [];
    assert.deepEqual(
      agents.map((a) => [a.key, a.state]),
      [
        ['claude', 'todo'],
        ['codex', 'todo'],
        ['opencode', 'todo'],
      ],
    );
    const [claude, codex, opencode] = agents;
    assert.deepEqual(
      claude?.methods.map((m) => m.commands),
      [
        ['npx --no spectrum skills install --agent claude'],
        [
          'claude plugin marketplace add voyager-fm/spectrum',
          'claude plugin install spectrum@spectrum',
        ],
      ],
    );
    assert.deepEqual(codex?.methods[0]?.commands, [
      'npx --no spectrum skills install --agent codex',
    ]);
    assert.deepEqual(opencode?.methods, codex?.methods, 'Codex and OpenCode share one skill file');
  });

  it('marks only the agents that are installed', () => {
    const codexOnly = setup({
      skills: {
        claude: item('missing', '.claude/skills/spectrum/SKILL.md'),
        codex: item('ok', '.agents/skills/spectrum/SKILL.md', '0.1.0'),
      },
    });
    const agent = step(codexOnly, 'agent');
    assert.equal(agent.state, 'done');
    assert.match(agent.summary, /Installed for Codex, OpenCode/);
    const [claude, codex] = agent.agents ?? [];
    assert.equal(claude?.state, 'todo');
    assert.equal(claude?.methods.length, 2, 'Claude Code still offers its commands');
    assert.equal(codex?.state, 'done');
    assert.deepEqual(codex?.methods, []);
  });

  it('counts either repository skills or the plugin as a connected agent', () => {
    const withSkill = setup({
      skills: {
        claude: item('ok', '.claude/skills/spectrum/SKILL.md', '0.1.0'),
        codex: item('missing', '.agents/skills/spectrum/SKILL.md'),
      },
    });
    assert.equal(step(withSkill, 'agent').state, 'done');
    assert.deepEqual(step(withSkill, 'agent').agents?.[0]?.methods, []);
    const withPlugin = setup({
      plugin: item('ok', '.claude/settings.json', 'spectrum@spectrum enabled'),
    });
    assert.equal(step(withPlugin, 'agent').state, 'done');
    assert.match(step(withPlugin, 'agent').agents?.[0]?.summary ?? '', /plugin is enabled/);
  });

  it('never counts a skill Spectrum did not install as done', () => {
    const unmanaged = setup({
      skills: {
        claude: item('unmanaged', '.claude/skills/spectrum/SKILL.md', 'not installed by Spectrum'),
        codex: item('missing', '.agents/skills/spectrum/SKILL.md'),
      },
    });
    const agent = step(unmanaged, 'agent');
    assert.equal(agent.state, 'attention');
    assert.deepEqual(agent.agents?.[0]?.methods[0]?.commands, [
      'npx --no spectrum skills install --agent claude --force',
    ]);
  });

  it('asks to repair an invalid configuration instead of running init over it', () => {
    const invalid = setup({
      config: item('invalid', '.spectrum/config.json', 'schema_version is not 2'),
    });
    const config = step(invalid, 'config');
    assert.equal(config.state, 'attention');
    assert.deepEqual(config.commands, []);
    assert.match(config.summary, /schema_version is not 2/);
  });

  it('is complete when every piece is present', () => {
    const all = onboardingSteps(
      setup({
        config: item('ok', '.spectrum/config.json', 'schema_version 2'),
        package: item('ok', 'package.json', '^0.1.0'),
        plugin: item('ok', '.claude/settings.json', 'spectrum@spectrum enabled'),
      }),
    );
    assert.equal(all.complete, true);
    assert.ok(all.steps.every((s) => s.commands.length === 0));
  });
});
