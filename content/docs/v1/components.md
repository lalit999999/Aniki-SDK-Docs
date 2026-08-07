---
title: Documentation Components
description: The interactive component library available inside documentation markdown.
category: Reference
order: 5
updated: 2026-08-07
---

# Documentation Components

Aniki-SDK's documentation pages are plain markdown, but a small set of
directives - `:::name`, `::name`, and `:name` syntax - unlock interactive,
styled components without leaving the content file. Every component below
is reusable, responsive, accessible, and dark-mode aware, and renders
through the same markdown pipeline as the rest of this site: search
indexing, reading time, and the table of contents all keep working inside
one, exactly as they do in ordinary prose.

This page grows with the component library - each new component gets a
section here, both as documentation and as a live check that it renders
correctly.

## Callouts

`:::callout{type=...}` or one of its six aliases - `:::note`, `:::tip`,
`:::warning`, `:::danger`, `:::success`, `:::info`. A `title` attribute or a
directive label overrides the type's default title.

:::note
A plain note, using its default title.
:::

:::tip[Did you know?]
Aliases take a directive label just like the base form.
:::

:::warning
Warnings and danger callouts share a destructive tone; the icon and label
are what actually distinguish them from each other and from the neutral
types.
:::

:::danger
This one can't be undone.
:::

:::success
Everything worked.
:::

:::info
Neutral, informational context that isn't quite a note.
:::
