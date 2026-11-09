# Distribution flow

## Contract References

- [Contract](../contracts/distribution.toml)

## Interaction Coverage

- [Install plugin](../SP-004/SP-004-install_plugin.md)
- [Run plugin checks](../SP-004/SP-004-run_plugin_checks.md)
- [Follow spec guardrails](../SP-008/SP-008-follow_spec_guardrails.md)

## Happy Path

1. The user adds this repository as a plugin marketplace and installs the Spectrum plugin in the host agent. No model credential is requested.
2. The host agent loads the Spectrum skill when the user mentions Spectrum, asks about spec validity or acceptance criteria, or is about to change behavior a spec covers.
3. The skill runs the bundled CLI (`check` or `list`) from the repository root and reads the JSON result and linked canonical documents.
4. The host agent answers or edits from that evidence, reports code/spec disagreements and proposes spec changes for the user to decide.

## Failure Handling

- A stale bundle fails the plugin build before release.
- A repository without `.spectrum/config.json` is reported as not set up; the agent does not invent a result.
- A nonzero CLI exit is reported with its findings, not retried into a pass or worked around by weakening criteria.
