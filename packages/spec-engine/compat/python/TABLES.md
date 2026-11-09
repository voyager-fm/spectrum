# Schema-driven table validation

`tsv_tables.py` validates optional tabular specification data. It is a value/reference
checker, separate from table search and Markdown parsing. It never rewrites sources.

## Root and catalog

Every invocation supplies a customer root. There is no package identity lookup,
import-time discovery or global customer cache. Default discovery looks for data.tsv
under `.spectrum/`, identifying tables by the complete root-relative directory path.
Two domains may therefore have identical final table-directory names. The default
format does not require tables: a Markdown-only project selects no table checks.

Callers may pass `paths={"qualified:name": "relative/records.tsv"}` for explicit names
and arbitrary filenames. References use these exact catalog names. The adjacent
schema.json defines that table's contract. Directory and binding paths must remain
inside the root, including resolved source/schema symlinks. Multiple invocations do
not share data or catalog state.

## Contract and values

The schema is a custom table-contract dialect, not standard JSON Schema. Its shape is
checked before values: ordered/unique columns, optional primary_key, boolean required,
string enums, and single/tuple refs. Invalid schema JSON or shapes produce diagnostics.
Selected tables pull in their referenced schemas; unrelated schemas are not validated
when a caller selects only a subset.

Value rules preserve strings and draft markers. `-` means not applicable; `TBD` means
undecided. Required fields reject `-` unless it is explicitly allowed in their enum.
Primary keys reject empty/placeholders and duplicates. Comparison ignores a leading
`<<AI>>` marker without editing it. `number` uses numeric conversion; other type labels
do not imply a complete type system. BOM and CRLF are supported. Tables without a
declared primary key do not receive duplicate-key checks.

Refs check single or tuple membership; pipe-separated single refs are supported.
They do not prove target uniqueness or same-row consistency across separate refs.
Additional fields such as null_values and enum_descriptions are metadata, not enforced
policy. Python CSV acceptance can differ from the stricter safe-query reader.

## CLI and regressions

```sh
python3.11 -B packages/spec-engine/compat/python/tsv_tables.py --root /customer/repository
python3.11 -B packages/spec-engine/compat/python/tsv_tables.py --root /customer/repository --table items=data/items/records.tsv
pnpm test:tables
```

`--directory` selects alternative discovery roots. `--baseline REF` compares against
a resolved Git commit using a multiset of diagnostics; line shifts do not create new
violations. Exit 1 means violations, 2 means blocked/invalid execution. With no tables,
the command explicitly reports NOT RUN rather than claiming data was validated.
The helper API's empty error list alone is not evidence that any tables were selected.
