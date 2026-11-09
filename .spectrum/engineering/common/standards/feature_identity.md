---
doc_type: standard
status: active
implementation_state: current
---

# Spectrum feature identity

Spectrum's own feature IDs use `<category_key>-<three digit category-local sequence>`, for example VAL-001 and TRC-001. Interaction IDs append a stable action suffix, for example TRC-001-inspect_linked_implementation. Allocate the next unused number within the category, never reuse retired IDs, and never infer identity from row order or display title.

This convention belongs to Spectrum's product inventory. Customer IDs remain opaque and do not need these prefixes. The engine must not impose Spectrum's categories or numbering on client repositories.

Feature bundles live at `product/feature_inventory/specs/<lowercase category_key>/<feature_id>/`. Category contracts and flows live in that category's contracts/ and flows/ directories. References across categories stay explicit repository-local links.

## Authorized migration

The previous product-wide SP namespace was replaced at the user's explicit request. This is a recorded identity migration, not a rule to renumber existing customer data or to renumber features when categories change. Preserve this crosswalk for historical commit and issue references; old HTTP ID redirects are not implemented by this documentation change.

| Previous ID | Canonical ID |
| --- | --- |
| SP-001 | VAL-001 |
| SP-002 | DSH-001 |
| SP-003 | LOOP-001 |
| SP-004 | AGT-001 |
| SP-005 | VAL-002 |
| SP-006 | DSH-002 |
| SP-007 | DSH-003 |
| SP-008 | AGT-002 |
| SP-009 | LOOP-002 |
| SP-010 | LOOP-003 |
| SP-011 | INT-001 |
| SP-012 | INT-002 |
| SP-013 | INT-003 |
| SP-014 | SET-001 |
| SP-015 | SET-002 |
| SP-016 | SET-003 |
| SP-017 | SET-004 |
| SP-018 | INT-004 |

## Verification

FI owns category/feature identity. Interaction metadata, IA references, contract ownership, flow coverage and page references use the same canonical IDs. Structural checks must pass after the migration. Declared lifecycle and unchecked ACs remain separate from executed evidence.

## Sources

- [Feature inventory](../../../product/feature_inventory/features.tsv)
- [Interaction inventory](../../../product/feature_inventory/interactions.tsv)
- [Schema guide](../../../schemas/README.md)
