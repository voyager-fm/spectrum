# CLI draft generation

Status: implemented creation and preview; semantic completion and apply are separate.

`new` selects canonical engine templates by alias or catalog ID. Description returns
raw templates and required value names without customer writes. Creation requires an
explicit string-map values file; no undecided product fact is invented.

Dry-run returns complete proposed paths/content without creating customer files or
directories. Normal creation uses exclusive bounded writes. Existing paths and unsafe
ancestors block the entire known plan. There is no overwrite/force mode; runtime I/O
failure can interrupt sequential writes and is not reported as a successful rollback.

The feature alias is an interaction/contract/flow draft bundle, not automatic FI or
configuration migration. Single-file output overrides do not rebase document links.
Creation/preflight success is independent of actual repository validation: check is
notRun until the caller invokes the real checker. Static draft annotations remain.

Module, CLI-process and standalone-bundle tests exercise canonical rendering, required
inputs, preview/no writes, creation, conflicts, traversal and embedded template assets.
