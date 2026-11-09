# Specification links

Status: implemented internal resolver/checker; plugin command wiring is separate.

Inputs explicitly identify the customer repository root and optional discovery roots.
Root notes and managed `.spectrum` Markdown are discoverable without product-specific
directories, inventories, package metadata or persistent per-customer caches.

Markdown and Wikilink destinations are parsed structurally. Code/fenced literals,
comments and metadata do not create spurious links. Unique short names resolve;
ambiguous names, missing notes/headings and local targets outside the root are
reported. Source symlink escapes and unavailable parser execution are blocked.
External URLs are not fetched and input files are not rewritten.

Markdown is the default generated style; Wikilinks are optional. Their heading
semantics are preserved separately. Managed dot-directory targets are checked.
No selected document is not a successful validation run. Asset-file integrity,
semantic bundle consistency and revision-bound impact are not claimed by this check.

`pnpm test:links` exercises neutral managed roots, AST destinations, Unicode,
duplicates, heading semantics, path boundaries, cache isolation and CLI outcomes.
