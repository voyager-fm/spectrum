# Spec graph flow

## Entry

Select **Graph view** beside the revision line on a connected repository's Specs page, or open `/repositories/<owner>/<repo>/specs/graph`. The revision query carries over.

## Ready

The graph settles and fits the view. Hover or select a node to see its neighbourhood; the panel lists the connected nodes and opens the node's reader page. Group toggles hide node kinds, and the highlight field finds nodes by ID, title or path.

## Empty and failure states

A commit with nothing to graph shows an empty notice. A repository that cannot be read shows the Specs page's sign-in, installation and load-error states. Hiding every group shows a notice on the canvas.

## Sources

- [Surface contract](contract.toml)
- [Layout](layout.md)
