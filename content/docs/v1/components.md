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

## Code blocks

A fenced code block renders through the shared `CodeBlock` component -
title, language badge, and a copy button, no syntax highlighting (that is
explicitly out of scope for this step).

```ts title="agent.ts" showLineNumbers {2}
export function greet(name: string) {
  return `Hello, ${name}!`;
}
```

## Terminal

` ```terminal ` renders a recorded terminal session instead of a plain code
block. A line starting with `$ ` or `> ` is a command, dimmed prompt and
all; everything else is output. The copy control copies commands only,
prompts stripped, so pasting the result runs cleanly.

```terminal
$ npm install @aniki/sdk
added 1 package in 812ms

$ npm run dev
> aniki-sdk-docs@0.1.0 dev
Ready on http://localhost:3000
```
