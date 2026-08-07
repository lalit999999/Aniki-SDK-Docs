---
title: Documentation Components
description: The interactive component library available inside documentation markdown.
category: Reference
order: 5
updated: 2026-08-08
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

## Authoring reference

Read this before writing a new directive into a content file. Every
mistake this bridge has actually produced traces back to one of the four
things below - the fallback card that appears in place of a broken
directive (development only; production renders the body as plain
markdown instead) always names which one.

### The three directive forms

| Form | Syntax | Has a body? | Example |
|---|---|---|---|
| Container | `:::name{attrs}` ... `:::` | Yes - block content | `:::callout{type=tip}` |
| Leaf | `::name{attrs}` | No | `::package-install{name="aniki-sdk"}` |
| Text | `:name[label]{attrs}` | No - inline only | `:badge[Beta]{variant=outline}` |

A directive registered as one form written as another fails with a
`DIRECTIVE_STRUCTURE_INVALID` error naming the correct syntax - `:::badge`
doesn't work because `badge` is registered as a text directive, not a
container.

### Nesting: outer containers need more colons

A container directive's fence is however many colons it opens with - not
always three. When a container's *body* contains another container
directive (`:::tabs` holding `:::tab`, `:::steps` holding `:::step`,
`:::accordion` holding `:::accordion-item`, `:::cards` holding `:::card`,
`:::features` holding `:::feature`), the **outer** one needs **four**
colons so its closing fence doesn't collide with the inner directive's own
`:::` close:

```md
::::tabs{sync="pkg"}
:::tab{label="npm"}
npm install
:::
:::tab{label="pnpm"}
pnpm add
:::
::::
```

Get this wrong - three colons on both - and the *inner* directive's
closing `:::` also closes the *outer* one early. The visible symptom is a
stray literal `:::` rendered as its own paragraph right after the first
inner block, and every directive after it silently falls outside the
container it was meant to be inside. If a tab, step, or card group looks
like it only has one child and there's a bare `:::` sitting in the
rendered page right after it, this is almost always why.

### The label form

`:::name[Label]` puts `Label` as the directive's title without an explicit
`title=` attribute - the bridge extracts it and merges it into `title`
generically for every component whose schema has one (`resolveDirective`'s
own D8 handling, not something each component re-implements). Two things
follow from that:

- An explicit `title=` attribute always wins over the label if both are
  present.
- The label is stripped from the rendered body. Don't repeat it as the
  first line of the directive's content - that would only happen if you
  hand-wrote the title into the body yourself, but it's a mistake worth
  knowing not to make, since nothing will warn you if you do.

### Attribute values are always strings

Directive syntax has no concept of a boolean, a number, or a list - every
attribute value `remark-directive` parses is a plain string, including a
bare flag like `{dev}`, which parses to `dev=""` (empty string), not
`true`. This library's schemas coerce centrally, so authoring reads
naturally:

- A bare flag - `{dev}`, `{auth}`, `{open}` - is truthy. So are `"true"`,
  `"yes"`, `"1"`, and `"on"`. `"false"`, `"no"`, `"0"`, and `"off"` are
  falsy; anything else is a validation error, not a silent default.
- `{columns=3}` arrives as the string `"3"`, coerced to the number `3` by
  the schema - never write a component that calls `Number()` or
  `Boolean()` on an attribute itself.
- A list attribute (`::package-install`'s `name`) accepts comma- *or*
  space-separated values - `name="react, vue node"` and
  `name="react vue node"` both split into `["react", "vue", "node"]`.

## Callouts

`:::callout{type=...}` or one of its six aliases - `:::note`, `:::tip`,
`:::warning`, `:::danger`, `:::success`, `:::info`. A `title` attribute or a
directive label overrides the type's default title.

:::callout{type=note}
The base form, spelled out - equivalent to `:::note` below.
:::

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
