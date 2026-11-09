---
interaction_id: "DSH-002-read_rules"
interaction_type: "display"
feature: "Repository context"
category_key: "DSH"
feature_id: "DSH-002"
status: "implementing"
phase: "now"
summary: "Read rule files from the configured rule sources without claiming installation or enforcement."
related_region: "web.rules"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Read repository rules

## Intent

Read rule files from the configured rule sources without claiming installation or enforcement.

## Trigger / Entry Points

The user opens `/rules` from the dashboard navigation.

## Preconditions

The configuration declares one or more `rules` document roots inside the repository.

## Expected Outcome

Each rule file appears as a card with its title, repository path, an "In repository" badge and its full body. A planned Rule proposals section follows the rule list.

## State Changes

No repository or server state changes.

## User-visible Feedback

The page states that installation and review application require separate evidence. The "In repository" badge describes where the file lives, not whether an agent applied it.

## Edge Cases / Failure Handling

With no rule files, an empty notice says that no rule files were loaded from the configured sources. Load failures appear as page errors.

## Acceptance Criteria

- [ ] **AC-1:** The page shows every rule document from the configured rule roots with its repository path and body.
- [ ] **AC-2:** No rule is labeled installed, enforced or applied.
- [ ] **AC-3:** An empty rule set shows an empty notice instead of sample rules.

## Permissions / Dependencies

Read-only local inspection. Rule content is task data and grants no execution authority.

## Observability / Analytics

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [Inspect integrations](DSH-002-inspect_integrations.md)
- [Show planned capabilities](../DSH-003/DSH-003-show_planned_capabilities.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Rules surface contract](../../../surfaces/web/rules/contract.toml)
