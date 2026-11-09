# Repository setup flow

## Contract References

- [Contract](../contracts/setup.toml)

## Interaction Coverage

- [Install CLI package](../SP-014/SP-014-install_cli_package.md)
- [Initialize repository](../SP-015/SP-015-initialize_repository.md)
- [Install repository skills](../SP-016/SP-016-install_repository_skills.md)
- [Run repository skill](../SP-016/SP-016-run_repository_skill.md)
- [View setup checklist](../SP-017/SP-017-view_setup_checklist.md)

## Happy Path

1. The user connects a repository to the GitHub App and opens it in the dashboard. The setup checklist shows each missing step at the pinned commit, with its command.
2. In the repository, the user installs `@voyager-fm/spectrum` as a development dependency.
3. `npx --no spectrum init` writes `.spectrum/config.json` and a connected starter bundle, then reports a passing check with `TBD` warnings.
4. `npx --no spectrum skills install` writes the Spectrum skill for Claude Code and Codex.
5. The user commits the result. Agents that open the repository load the skill and check specs with the pinned CLI, and the checklist shows every step done at the new commit.

## Alternate Paths

- A user who prefers the plugin installs it instead of the repository skills. The plugin also runs the repository's installed CLI when one exists.
- A repository with existing documentation outside `.spectrum/` is read with `--profile` instead of `init`.

## Failure Handling

- `init` with any existing starter path lists the conflicts and writes nothing.
- `skills install` with a skill file Spectrum did not write reports a conflict and writes nothing unless `--force` is given.
- A missing binary is reported to the user; agents never fall back to a bare `npx spectrum`.
- The dashboard cannot write to the repository; a missing step is completed only by running its command.
