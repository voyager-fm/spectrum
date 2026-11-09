# Spectrum
AI-powered product specs for your codebase.

## Product intent
A CLI, dashboard, and GitHub bot share repository-native specifications. Start from an existing repository (brownfield) or an idea (greenfield). Connect requirements to issues and reviews without treating generated prose as verified implementation.

## Organization
Features combine intent, behavior, acceptance criteria, and implementation constraints. Shared contracts, flows, and rules live once here, rather than separate PRODUCT and ENGINEERING trees.

## Current boundary
The scaffold implements deterministic JSON-spec checking and a local read-only dashboard. Agents, remote repository discovery, GitHub/Linear integrations, authentication and hosted storage are NOT implemented. JSON feature records are an initial format, not a frozen public protocol.

## Next slice
Draft a ChangeSet against one own feature, show its diff and findings, require human approval, then revalidate before writing. Follow with GitHub installation, signed/idempotent webhooks, and PR-bound review publication. BYOK and subscription adapters are separate later decisions.
