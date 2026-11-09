# Proposed document edits

Status: implemented internal text helpers; filesystem apply and approval are separate.

Helpers read captured Markdown and return proposed text for selected scalar metadata,
H1 titles and H2 bodies. They use the installed parser and UTF-8 source ranges; no
process-global customer source/AST cache is retained. Batch parsing preserves each
document's metadata result and reports malformed YAML independently.

Edits preserve unrelated bytes, comments, quoting, protected code/HTML and document
line-ending conventions. Duplicate/ambiguous headings and invalid/overlapping or
split-character byte ranges are rejected. Changed metadata proposals are reparsed
to reject unintended YAML changes; unsupported complex metadata is not silently
normalized. The helper never writes a file or grants review/approval status.

`node scripts/test-document-edits.ts` exercises minimal edits, batching, Unicode,
CRLF, caller-owned AST isolation, malformed metadata, proposal idempotence and
read-only composition using the real installed parser. Canonical templates are
owned separately by `packages/spec-engine/templates/`; these helpers do not replace
that renderer or claim application to every unsupported YAML form.
