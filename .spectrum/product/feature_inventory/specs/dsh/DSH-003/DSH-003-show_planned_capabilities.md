---
interaction_id: "DSH-003-show_planned_capabilities"
interaction_type: "display"
feature: "Planned capability states"
category_key: "DSH"
feature_id: "DSH-003"
status: "implementing"
phase: "now"
summary: "Explain proposals, runs, PR reviews, rule proposals and model providers as unavailable without controls or sample history."
related_region: "web.agent_loop"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Show planned capabilities

## Intent

Explain proposals, runs, PR reviews, rule proposals and model providers as unavailable without controls or sample history, so a developer never mistakes a planned capability for a working one.

## Trigger / Entry Points

The user opens `/proposals`, `/runs` or `/reviews`, reaches the Rule proposals section of `/rules`, or follows an Agent loop card from the Overview.

## Preconditions

None. These pages render without repository data.

## Expected Outcome

Each page shows a planned-state panel with a Not implemented badge, the reason it is unavailable, the governing contract when one exists and the list of upcoming capabilities. Navigation marks these items as Planned.

## State Changes

No repository, server or external state changes.

## User-visible Feedback

The reason names what is missing, for example that no proposal store or generator exists or that no GitHub App or webhook is connected. Local browsing and checks remain available.

## Edge Cases / Failure Handling

A page keeps its planned state when a related configuration flag is enabled. When a capability is implemented, its page moves to an implemented interaction and this planned state is removed for it.

## Acceptance Criteria

- [ ] **AC-1:** Proposals, Runs and PR reviews show a Not implemented planned state with a reason and upcoming capabilities.
- [ ] **AC-2:** Planned pages offer no button, form or link that starts execution.
- [ ] **AC-3:** Planned pages show no sample proposals, run history or review results.
- [ ] **AC-4:** Navigation labels each planned page as Planned.

## Permissions / Dependencies

No permissions are required. The planned state grants no execution authority.

## Observability / Analytics

Browser smoke tests cover the planned states and the absence of execution controls. No runtime telemetry exists.

## Related Interactions

- [Review proposal](../../loop/LOOP-001/LOOP-001-review_proposal.md)
- [View repository overview](../DSH-001/DSH-001-view_repository_overview.md)
- [Read repository rules](../DSH-002/DSH-002-read_rules.md)

## Source

- [Contract](../contracts/dashboard.toml)
- [Flow](../flows/dashboard.md)
- [Proposals page contract](../../../../website/page_contracts/proposals/contract.toml)
- [Runs page contract](../../../../website/page_contracts/runs/contract.toml)
- [PR reviews page contract](../../../../website/page_contracts/reviews/contract.toml)
