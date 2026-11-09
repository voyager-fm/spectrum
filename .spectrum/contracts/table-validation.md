# Table validation

Status: implemented internal value/reference checker; runtime tool adapter is separate.

## Selection

Tables are optional. The checker accepts an explicit customer root and either
root-relative discovery directories (default .spectrum) or named file bindings.
Directory basenames alone do not identify tables. Customer repositories do not need
package.json, product-specific directories, UI inventories or preselected ID enums.

## Checks

Validate the custom schema contract before checking headers, row width, blank values,
required fields, enum/number values, declared primary keys and single/tuple references.
Reject source/schema paths escaping the root. Preserve original bytes and placeholder
semantics. Separate tables without keys from tables with invalid keys. Keep each
call's catalog/value caches local. Source diagnostics include file and physical line
where the underlying checker can identify them.

An absent table selection is not a successful validation run. Invalid schema is not
silently ignored. Baseline comparison counts repeated findings rather than collapsing
them into a set. A query success does not establish these value/reference checks.

## Limits and evidence

The checker does not validate product meaning, implementation correctness, arbitrary
schema type systems, target uniqueness or cross-reference same-row consistency.
It is not yet a hosted reviewer tool and does not grant write/approval authority.
`pnpm test:tables` exercises preserved value/ref/baseline behavior and neutral customer
roots, duplicate table basenames, arbitrary paths, malformed schemas and path escapes.
