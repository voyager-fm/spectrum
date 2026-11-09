# Spec category flow

## Entry

Open a category from the specification tree, a category row of the categories and features table, a spec or feature breadcrumb or ⌘K search. The path is `/specs/categories/[key]`.

## Ready

The page reads the category's description from the inventory, lists its features in ID order and every interaction under it. Lifecycle counts are declared values, not executed evidence.

## Empty and failure states

An unknown category key returns not found. A category with no features or interactions says so. A category referenced by interactions but not declared in the inventory is labeled as not declared. Failed loads show an error and unavailable values.

## Sources

- [Surface contract](contract.toml)
- [Layout](layout.md)
