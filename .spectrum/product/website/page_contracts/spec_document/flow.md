# Spec document flow

## Entry

Open a document from the specification tree, the documents table, a link inside another document, the reader rail or ⌘K search. The path is the document's repository-relative path under `/specs/documents/`.

## Ready

Markdown documents render as text with an outline of their sections. TOML, JSON, TSV and other documents show their source with line numbers. The rail lists the documents this one links to and the documents that link to it.

## Empty and failure states

A path that is not a loaded document returns not found. Failed loads show an error and unavailable values. Links to paths outside the loaded documents are plain text locally and open GitHub at the checked SHA for a connected repository.

## Sources

- [Page contract](contract.toml)
- [Layout](layout.md)
