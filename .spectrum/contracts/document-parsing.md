# Document parsing

Status: implemented internal parsing primitives; domain layout validation is separate.

## Input and ownership

The specification engine parses Markdown text independently of customer directory
names. Repository-backed parsing accepts an explicit Git root and snapshot and uses
the installed parser. A customer repository does not need package.json or scripts.

## Observable behavior

- Extract real headings, IDs, Markdown links and Wikilinks; fenced headings do not
  become document sections.
- Structured output includes YAML metadata, sections, fences and protected ranges.
- Source ranges are UTF-8 byte offsets, including non-ASCII text.
- Malformed YAML produces a metadata error rather than a valid empty document.
- Parsing does not edit input documents.
- Cache and worktree observations belong to one document repository instance.
  Changed observed content is rejected, not silently substituted into that snapshot.
- Missing/failed parser execution is blocked, not a successful empty parse.

## Verification

`pnpm test:documents` runs the repository snapshot and document parser regressions.
Metadata parsing and stable source evidence do not imply semantic approval,
successful implementation, or support for the complete domain/feature document model.
