---
interaction_id: "AGT-001-install_plugin"
interaction_type: "command"
feature: "Distribute Spectrum as an agent plugin"
category_key: "AGT"
feature_id: "AGT-001"
status: "implementing"
phase: "now"
summary: "Install the Spectrum plugin from this repository's marketplace without model credentials."
related_region: "plugin.spectrum"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Install plugin

## Intent

Install the Spectrum plugin from this repository's marketplace without model credentials.

## Trigger / Entry Points

The user runs `claude plugin marketplace add voyager-fm/spectrum`, then `claude plugin install spectrum@spectrum`.

## Preconditions

The host agent supports plugin marketplaces. The repository root has `.claude-plugin/marketplace.json` listing `apps/plugin`, and the plugin manifest declares its name, version, description and author.

## Expected Outcome

The host agent installs the `spectrum` plugin with its `spectrum` skill and the checked-in CLI bundle. The skill becomes available in any repository the user opens.

## State Changes

The host agent records the installed plugin in its own configuration. No file in the user's repository changes, and no Spectrum account or service credential is created.

## User-visible Feedback

The host agent reports the installed plugin and skill. The plugin README lists the install commands and the bundled skill.

## Edge Cases / Failure Handling

A host without plugin marketplace support cannot install the plugin; support for another host requires host-specific evidence before it is claimed. A plugin build with a stale CLI bundle fails before release.

## Acceptance Criteria

- [ ] **AC-1:** The repository marketplace lists exactly the `apps/plugin` plugin with a description and category.
- [ ] **AC-2:** Installation requests no model or service credential.
- [ ] **AC-3:** The installed plugin contains the product skills from `apps/plugin/skills` and none of the development skills from `.apm/library`.

## Permissions / Dependencies

Installation runs in the user's host agent with its own permissions. Spectrum grants itself no repository write permission.

## Observability / Analytics

Install counts and host telemetry are not collected.

## Related Interactions

- [Run plugin checks](AGT-001-run_plugin_checks.md)
- [Follow spec guardrails](../AGT-002/AGT-002-follow_spec_guardrails.md)

## Source

- [Contract](../contracts/distribution.toml)
- [Flow](../flows/distribution.md)
- [Distribution architecture](../../../../contracts/distribution.md)
