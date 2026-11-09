# Specs flow

## Entry

Open `/specs` for the configured local repository.

## Ready

Browse interactions and their canonical document relationships. Filters narrow the interaction table and are kept in the URL, so a filtered view can be shared or reloaded. Interactions declared only in the inventory are listed without a document link. The categories and features table shows each description, interaction count and lifecycle mix, and opens category and feature pages. ⌘K or `/` opens search over interactions, categories, features and documents.

## Empty and failure states

A successful empty load identifies its source. Failed loads show an error and unavailable values. Filters that match nothing show a notice with a clear action. An unknown interaction ID returns not found. Unimplemented adapters remain planned.

## Sources

- [Surface contract](contract.toml)
- [Layout](layout.md)
