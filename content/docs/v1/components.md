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

## File tree

`:::file-tree` renders a project folder structure from an ordinary nested
markdown list - no directive syntax for individual entries, since a list is
already the natural way to author one. An entry with a trailing `/` (or
with children of its own) renders as a folder; wrap a name in `**bold**` to
highlight it.

:::file-tree
- src/
  - app/
    - **page.tsx**
    - layout.tsx
  - lib/
    - utils.ts
- package.json
- README.md
:::

## Tabs

`::::tabs{sync="..."}` wraps one or more `:::tab{label="..."}` children.
Two tab groups sharing the same `sync` key move together, and the choice
survives a reload.

::::tabs{sync="pkg-example"}
:::tab{label="npm"}
```bash
npm install @aniki/sdk
```
:::
:::tab{label="pnpm"}
```bash
pnpm add @aniki/sdk
```
:::
:::tab{label="yarn"}
```bash
yarn add @aniki/sdk
```
:::
::::

## Code groups

`::::code-group` wraps several fenced code blocks - each panel's tab label
comes from its fence's `title`, falling back to its language.

::::code-group
```bash title="npm"
npm install @aniki/sdk
```
```bash title="pnpm"
pnpm add @aniki/sdk
```
```bash title="yarn"
yarn add @aniki/sdk
```
::::

## Steps

`::::steps` wraps one or more `:::step{title="..."}` children, numbered by
position rather than an author-supplied index. A step's body is arbitrary
markdown - including a heading, to prove it still gets a working
table-of-contents anchor.

::::steps
:::step{title="Install"}
```bash
npm install @aniki/sdk
```
:::
:::step{title="Configure"}
### Add your API key

Create a `.env` file with `ANIKI_API_KEY=...`.
:::
:::step[Run]
```terminal
$ npm run dev
Ready on http://localhost:3000
```
:::
::::

## Accordions

`::::accordion{type=single|multiple}` wraps one or more
`:::accordion-item{title open}` children. The second item below starts
collapsed but still has a heading in its body, to prove a collapsed item's
content still gets a working table-of-contents anchor - Radix keeps it
mounted for the collapse animation rather than removing it.

::::accordion{type=single}
:::accordion-item{title="Is Aniki SDK free?" open}
Yes - it's MIT licensed and free for commercial use.
:::
:::accordion-item{title="What does streaming support look like?"}
### Streaming responses

Every provider adapter implements the same async-iterator interface.
:::
:::accordion-item{title="Can I self-host it?"}
Yes, there are no required external services.
:::
::::

## Cards

`::::cards{columns}` wraps one or more `:::card{title icon href}`
children. `columns` is a maximum - the grid always collapses to a single
column on mobile. A card with an `href` is a link with a hover lift; an
absolute URL additionally gets an external-link arrow.

::::cards{columns=3}
:::card{title="Quick Start" icon=rocket href="/docs/quick-start"}
Get an agent running in five minutes.
:::
:::card{title="API Reference" icon=book href="/docs/api-reference"}
Every exported function, typed and documented.
:::
:::card{title="GitHub" icon=code href="https://github.com/aniki-sdk/aniki"}
Star the repo or open an issue.
:::
::::

## Feature grid

`::::features{columns}` wraps one or more `:::feature{title icon}`
children - denser than cards, no border or link, built to double as
landing-page content later.

::::features{columns=3}
:::feature{title="Multi-provider" icon=puzzle}
Swap OpenAI, Anthropic, or a local model without touching agent code.
:::
:::feature{title="Streaming-first" icon=zap}
Every response is an async iterator, not an afterthought.
:::
:::feature{title="Type-safe" icon=shield}
Strict TypeScript from the SDK surface down to provider adapters.
:::
::::

## Badges

`:badge[Label]{variant}` is an inline badge for prose: :badge[New],
:badge[Beta]{variant=outline}, :badge[Deprecated]{variant=destructive}.

## API endpoint cards

`:::api-endpoint{method path auth deprecated}` - `method` is uppercased
before validation, so `method=get` and `method=GET` both work. `path` must
start with `/`. The method always renders as text next to its colour, never
as colour alone.

:::api-endpoint{method=GET path="/v1/agents" auth}
Lists every agent in the current workspace.
:::

:::api-endpoint{method=DELETE path="/v1/agents/:id" auth deprecated}
Deletes an agent. Superseded by the bulk delete endpoint below.
:::

## Playground

`:::playground{title status=coming-soon|beta href}` marks a known future
capability - the in-browser interactive playground from Claude.md's Future
Features - without pretending it already exists. When the real thing
ships, only this component's internals change; no content file will need
to be touched.

:::playground{title="Streaming chat" status=beta href="https://github.com/lalit999999/Aniki-SDK"}
Try the streaming example in the SDK repository while the in-browser
playground is still being built.
:::

## Package install

`::package-install{name dev global exec}` switches between npm, pnpm,
yarn, and bun, remembering your last choice. `name` defaults to the SDK's
own package name when omitted, and accepts a space- or comma-separated
list for more than one package.

::package-install{}

::package-install{name="create-aniki-app" exec}
