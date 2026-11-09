# Spec feature flow

## Entry

Open a feature from the specification tree, the categories and features table, a category page, a spec breadcrumb or ⌘K search. The path is `/specs/features/[id]`.

## Ready

The page reads the feature's description and related UI region from the inventory and lists every interaction that belongs to it. Lifecycle counts are declared values, not executed evidence.

## Empty and failure states

An unknown feature ID returns not found. A feature with no interactions says so. A feature referenced by interactions but not declared in the inventory is labeled as not declared. Failed loads show an error and unavailable values.

## Sources

- [Surface contract](contract.toml)
- [Layout](layout.md)
