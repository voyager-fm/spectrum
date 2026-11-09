# Specification document links

`document_links.py` resolves Markdown/Wikilink destinations and checks existing
Markdown files and headings within an explicit customer repository root. The
installed parser is independent of customer code or package identity.

Discovery includes root Markdown notes and `.spectrum/**/*.md` by default. Alternative
relative document roots are explicit. There is no product-directory allowlist or
persistent note/text cache, so later calls and different customers see their own data.
Source and target symlinks cannot be used to read outside the selected repository.

`document_targets(text, source_path, root)` preserves Markdown destinations and turns
Wikilink vault/relative paths into source-relative destinations. Short names must
identify one discovered note; ambiguity is explicit. Parsing respects frontmatter,
comments and code fences. Optional heading conversion affects only Wikilinks.

`document_link(..., style='markdown')` defaults to standard Markdown. Wiki output is
an explicit style choice. Shared Markdown heading anchors and human-readable wiki
headings have different matching semantics and are not silently interchanged.

`check_document_links(root)` reports missing files/headings, ambiguous names and local
targets outside the repository. External URLs are not fetched. The checker does not
skip `.spectrum/` Markdown targets merely because the directory begins with a dot.
Non-Markdown asset existence and contract/flow meaning remain separate checks.

```sh
python3.11 -B packages/spec-engine/compat/python/document_links.py --root /customer/repository
pnpm test:links
```

No selected documents is NOT RUN, broken links return exit 1, and blocked parser/path
execution returns 2. The checker does not write sources, make approvals or infer
implementation correctness. Working-tree link checking is not a pinned Git snapshot;
revision-bound relation analysis is a separate owner. Legacy checker-consumer tests
are not evidence of the new domain bundle adapter, which is not implemented here.
