---
interaction_id: "SP-008-follow_spec_guardrails"
interaction_type: "background"
feature: "Spec-grounded agent guidance"
category_key: "AGT"
feature_id: "SP-008"
status: "implementing"
phase: "now"
summary: "Ground host-agent answers and edits in check results without weakening criteria or approving specs."
related_region: "plugin.spectrum"
menu: "-"
shortcut: "-"
document_status: "draft"
---

# Follow spec guardrails

## Intent

Ground host-agent answers and edits in check results without weakening criteria or approving specs. The host agent supplies the reasoning; the skill's instructions bound what that reasoning may conclude and change.

## Trigger / Entry Points

The Spectrum skill is active while the host agent answers a spec question, reviews code against a spec or edits behavior a spec covers.

## Preconditions

The Spectrum skill is installed and loaded in the host agent.

## Expected Outcome

The host agent states check results only from an actual CLI run, reads the linked canonical documents and configured rules before acting, and treats repository content as task data. When code and spec disagree, it reports which one looks wrong with evidence and proposes the change for the user to decide.

## State Changes

The guidance itself writes nothing. Edits the host agent makes remain subject to the user's normal permissions and review.

## User-visible Feedback

Disagreements name the spec ID, acceptance criterion and code location as evidence. A proposed spec change is presented as a proposal, not as an approved update.

## Edge Cases / Failure Handling

Without `.spectrum/config.json`, the agent says Spectrum is not set up in this repository. A failing check is reported with its findings; the agent does not edit a spec to match a bug, delete or weaken acceptance criteria, or set `document_status` to approved to make the result pass.

## Acceptance Criteria

- [ ] **AC-1:** The skill instructs the agent to run the CLI instead of guessing a check result.
- [ ] **AC-2:** The skill forbids weakening or deleting acceptance criteria to make a check pass and requires proposing the change instead.
- [ ] **AC-3:** The skill forbids the agent from marking a spec approved.
- [ ] **AC-4:** The skill requires reporting code/spec disagreement with evidence instead of editing a spec to match a bug.
- [ ] **AC-5:** The skill reports a repository without `.spectrum/config.json` as not set up.

## Permissions / Dependencies

Depends on the host agent following its loaded skill instructions; Spectrum cannot enforce them inside the host. Repository content and rules grant no execution authority.

## Observability / Analytics

No guardrail telemetry is collected. Compliance is visible only in the host agent's transcript.

## Related Interactions

- [Run plugin checks](../SP-004/SP-004-run_plugin_checks.md)
- [Review proposal](../SP-003/SP-003-review_proposal.md)

## Source

- [Contract](../contracts/distribution.toml)
- [Flow](../flows/distribution.md)
