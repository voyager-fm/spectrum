---
interaction_id: "DSH-001-view_repository_overview"
interaction_type: "display"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "DSH-001"
status: "implementing"
phase: "now"
summary: "Summarize structural check health, specification counts, rules and mode for the configured repository."
related_region: "web.overview"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View repository overview

## Intent

Summarize structural check health, specification counts, rules and mode for the configured repository.

## Trigger / Entry Points

The user opens `/`, the dashboard's first page.

## Preconditions

The dashboard server runs locally and can read the configured repository. External service authentication is not required.

## Expected Outcome

Summary cards show the structural check result and finding count, the number of interaction specifications and how many are marked approved, the number of rule files, and the configured mode and canonical source. Findings appear in a table with code, path and message. An Agent loop section links to Proposals, Runs and PR reviews as not implemented, and to Integrations with the GitHub App connection state and Linear as not implemented.

## State Changes

No repository or server state changes.

## User-visible Feedback

The check card says the check is deterministic and uses no model. The approved count is labeled as document review only.

## Edge Cases / Failure Handling

When the check cannot run, the check card shows "Could not run" and the load error appears above the cards. Missing configuration shows the mode as unknown. Without findings, the findings table is omitted rather than filled with sample rows.

## Acceptance Criteria

- [ ] **AC-1:** The check card shows passed or failed from the shared engine result and the same finding count as the CLI.
- [ ] **AC-2:** A failed load shows "Could not run" with the error and never a passing result.
- [ ] **AC-3:** The approved count is labeled as document review state, not implementation or test evidence.
- [ ] **AC-4:** Agent loop links show a Not implemented state.

## Permissions / Dependencies

Read-only local inspection. The page offers no action that writes to the repository.

## Observability / Analytics

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [Check repository](../../val/VAL-001/VAL-001-check_repository.md)
- [Browse specifications](DSH-001-browse_specifications.md)
- [Show planned capabilities](../DSH-003/DSH-003-show_planned_capabilities.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Overview page contract](../../../website/page_contracts/overview/contract.toml)
