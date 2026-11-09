# Structured document parsing

`parse_markdown.mjs` reads a JSON array of Markdown strings from standard input and
returns a JSON array. Plain output contains heading titles, generated IDs and link
references. `--structured` additionally returns parsed YAML metadata, sections,
fences, protected code/HTML ranges and UTF-8 byte ranges. `--engineering` retains
the structured-output alias; it does not impose document paths or product policy.

Malformed YAML is reported as `metadata_error`, not silently accepted as an empty
valid document. Fenced headings are not real sections. Wikilinks and Markdown links
remain distinguishable, and source strings are not rewritten. The parser uses its
package's direct YAML dependency, not a linter's transitive dependency.

`../python/document_model.py` composes this parser with repository snapshots.
`DocumentRepository(customer_root, revision)` locates the installed parser separately
from the customer repository. The customer needs Git for snapshots, but does not need
package.json, a scripts directory or a particular documentation tree. Callers may
explicitly override the parser installation root. Cache entries are scoped to one
repository object and the first observed file digest; later changes are blocked.

Run `pnpm test:documents` for snapshot and document parser regressions. Python 3.11+
and Node >=22.18 are required. These parsers report structure; they do not validate
product meaning, custom TOML policy, AC coverage or customer document lifecycle.
