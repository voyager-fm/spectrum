# Captured-document metadata and section helpers

`product_document.py` reads captured Markdown strings and returns proposed edited
strings. The `ProductDocument` name is retained for compatibility. The helpers do
not require a customer directory layout, frontmatter identifiers, lifecycle states,
heading vocabulary, or document language.

## Runtime and imports

Use Python 3.11+ with `packages/spec-engine/compat/python` on `PYTHONPATH`.
The shared `document_model` adapter runs the installed
`compat/node/parse_markdown.mjs` using Node and the package's declared parser
dependencies. Customer working directories do not locate the parser. A missing or
failed parser raises the adapter's `Blocked` exception rather than returning a
successful parse.

```python
from product_document import (
    parse_documents_many,
    patch_frontmatter_fields,
    replace_h1_title,
    replace_section_body,
)

source = '---\nowner: "Ada" # keep\n---\n\n# Example\n\n## Notes\n\nOld.\n'
documents = parse_documents_many([source])
assert documents[0].metadata.metadata == {"owner": "Ada"}
assert documents[0].section_body("Notes") == "Old."

proposal, changed_fields = patch_frontmatter_fields(source, {"owner": "Grace"})
proposal, title_changed = replace_h1_title(proposal, "Updated example")
proposal, body_changed = replace_section_body(proposal, "Notes", "New.")
```

The caller owns captured text, parser dictionaries, returned document objects, and
their lifetime. There is no process-global or persistent cache of customer text.
Use a `ProductDocument` from `parse_documents_many` when metadata and section reads
should reuse one parse. Separate single-document helper calls parse independently.

## Reading and batching

- `parse_document(text)` returns the shared structured parser result, including
  UTF-8 byte ranges and protected ranges.
- `parse_documents_many(texts, batch_size=100)` returns ordered `ProductDocument`
  objects containing the original text, AST and `MetadataParseResult`. It starts
  one parser process per nonempty batch. Batch size must be positive; empty input
  starts no process. The AST remains available even if metadata is malformed.
- `metadata_results_many` returns ordered per-document metadata/error results.
  Malformed YAML or unsupported metadata in one document does not discard its
  neighbors' results. Parser-runtime failures block the call as a whole.
- `metadata_strings_many` is the fail-fast compatibility view: a metadata failure
  raises `ValueError` with the zero-based document index.
- `metadata_strings` requires a YAML mapping of scalar values. Null becomes `""`;
  strings, numbers and booleans use Python `str` conversion (for example, YAML
  `true` becomes `"True"`). Lists and nested mappings are rejected, even if only
  another field would be edited. Missing recognized frontmatter reads as `{}`.
- `section_body` and `ProductDocument.section_body` select an exact H2 title and
  strip only leading/trailing CR/LF from its body. Nested headings belong to the
  selected section. A missing heading returns `None`; duplicate selected headings
  raise `ValueError`.
- `section_records` exposes section records at the requested level (H2 by default).
  `section_lines` returns H2 titles and their body lines and rejects duplicate H2
  titles instead of overwriting them. `h1_title` returns a single H1 title or
  `None`, and rejects multiple H1s.

## Proposed edits and preservation

`patch_frontmatter_fields(text, updates)` returns `(proposal, changed_keys)` in
update order. Keys and values must be strings. Existing editable single-line scalar
value ranges are replaced with JSON-quoted YAML strings, preserving surrounding
spacing, inline comments, unrelated quoting, and every byte outside those ranges.
An unchanged semantic value keeps its original quoting. Empty scalar slots can be
filled without deleting adjacent comments. Missing fields are inserted immediately
before the closing delimiter using the frontmatter's LF or CRLF convention.
Inserted keys must match `[A-Za-z0-9_-]+`; existing quoted or complex keys without a
safe parser range cannot be edited.

The helper requires recognized, valid mapping frontmatter. Duplicate YAML keys,
non-scalar values, block scalars, anchors, aliases and unsafe ranges are not a
general YAML editing interface. Proposed changed metadata is parsed again and
compared with the requested scalar result, so a partial multiline-scalar edit
cannot silently change a different value. Only selected scalar ranges are edited;
the full document is never re-serialized.

`replace_h1_title` and `replace_section_body` return `(proposal, changed)` and leave
the source untouched when the selected heading is absent. Ambiguous headings raise
`ValueError`. H1 replacement emits `# <new_title>` and preserves the heading's line
ending. A section-body replacement strips the supplied body's surrounding
whitespace, inserts one blank line after the heading, and adds one terminal line
ending at EOF or two before the next peer heading. Its added boundary line endings
use CRLF if present in the document, otherwise LF. Line endings inside the supplied
body are caller-provided. These formatting rules are retained compatibility
behavior, not a formatting-preserving edit of the selected body itself.

The shared Markdown parser ignores fake headings in fenced/indented code and HTML
blocks. Those blocks and all other content outside the selected range stay intact.
Replacing an entire section body intentionally replaces everything within that
body, including any nested headings or code blocks there. Protected ranges remain
available in the AST; they are not an authorization mechanism. Patch offsets refer
to the original UTF-8 source. Out-of-bounds, overlapping and split-character patch
ranges are rejected.

## Limits and integration

These APIs do not write files, apply or synchronize plans, approve changes, publish,
resolve stale revisions, or perform model calls/reviews. The caller must preserve
source line endings when capturing text and must handle snapshot/staleness and
approval through its own integration before any eventual write. New title/body
strings are Markdown supplied by the caller, not escaped prose or policy-validated
content. Parser recognition of frontmatter and headings remains the shared
parser's responsibility; these helpers do not implement a second parser.

Run the owning real-parser suite from the workspace root:

```sh
node scripts/test-document-edits.ts
```

The runner selects only `test_product_document.py`, uses the installed parser and
existing dependencies, and disables Python bytecode output. Root test wiring is
owned by the integration session.
