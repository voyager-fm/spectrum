---
interaction_id: "DSH-001-view_repository_overview"
interaction_type: "display"
feature: "Specification browsing"
category_key: "DSH"
feature_id: "DSH-001"
status: "implementing"
phase: "now"
summary: "Summarize structural check health and specification counts for the configured repository."
related_region: "web.overview"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# View repository overview

## Intent

Summarize structural check health and specification counts for the configured repository.

## Trigger / Entry Points

The user opens `/`, the dashboard's first page.

## Preconditions

The dashboard server runs locally and can read the configured repository. External service authentication is not required.

## Expected Outcome

Two summary cards show the structural check result with its finding count, and the number of interaction specifications with the number of categories they span. Below the cards, the Spec health, Acceptance criteria and grouped Findings sections chart the same result (see Specification health interactions). The page shows no rule-file, mode or Agent loop cards: rules and integrations have their own pages, and the planned Agent loop pages are listed once, in the sidebar's collapsed Planned group.

## State Changes

No repository or server state changes.

## User-visible Feedback

The page description states that document status is not implementation or test evidence. The check card says the check is deterministic and uses no model. Sections below do not repeat these statements.

## Edge Cases / Failure Handling

When the check cannot run, the check card shows "Could not run" and the load error appears above the cards. Without findings, the Findings section states that there are none; it never shows sample rows. The local repository stores no check history, so the page has no Check trend section.

## Acceptance Criteria

- [ ] **AC-1:** The check card shows passed or failed from the shared engine result and the same finding count as the CLI.
- [ ] **AC-2:** A failed load shows "Could not run" with the error and never a passing result.
- [ ] **AC-3:** The page description states once that document status is not implementation or test evidence.
- [ ] **AC-5:** The page shows no rule-file, mode or Agent loop cards and no Check trend section.

## Permissions / Dependencies

Read-only local inspection. The page offers no action that writes to the repository.

## Observability / Analytics

Page load errors are shown in the page. Hosted telemetry remains unimplemented.

## Related Interactions

- [Check repository](../../val/VAL-001/VAL-001-check_repository.md)
- [Browse specifications](DSH-001-browse_specifications.md)
- [Show planned capabilities](../DSH-003/DSH-003-show_planned_capabilities.md)
- [View status distribution](../DSH-004/DSH-004-view_status_distribution.md)
- [Group findings](../DSH-004/DSH-004-group_findings.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Overview page contract](../../../../website/page_contracts/overview/contract.toml)
