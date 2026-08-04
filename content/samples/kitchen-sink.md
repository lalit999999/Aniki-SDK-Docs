## Heading Level Two

### Heading Level Three

#### Heading Level Four

##### Heading Level Five

###### Heading Level Six

A paragraph with **bold**, *italic*, ~~strikethrough~~, and `inline code`,
plus an internal link to [the docs index](/docs), a relative link to
[the tools guide](./tools.md), a relative link to a
[missing document](./this-document-does-not-exist.md), an anchor link to
[the tables section below](#a-gfm-table), and an external link to
[the Next.js site](https://nextjs.org).

> A plain prose blockquote, not an admonition - the kind already used
> throughout `content/docs` (e.g. `> **Note** — ...`), which
> `remark-admonitions` must leave completely untouched.

---

## Lists

### Unordered, ordered, and nested

- First unordered item
- Second unordered item
  - Nested item one
  - Nested item two
    1. Deeply nested ordered item
    2. Another deeply nested ordered item
- Third unordered item

1. First ordered item
2. Second ordered item
   - Nested unordered item
3. Third ordered item

### Task list

- [ ] An incomplete task
- [x] A completed task
- [ ] Another incomplete task

## An Image

![A descriptive alt text for a placeholder diagram](https://placehold.co/600x300)

## A GFM Table

| Feature | Supported | Notes |
| :-- | :-: | --: |
| Tables | Yes | GFM |
| Alignment | Yes | left/center/right |
| Task lists | Yes | see above |

## Admonitions

> [!NOTE]
> This is a note admonition, using GitHub alert syntax.

> [!TIP]
> This is a tip admonition.

> [!IMPORTANT]
> This is an important admonition.

> [!WARNING]
> This is a warning admonition.

> [!CAUTION]
> This is a caution admonition.

## Callouts

:::note
This is a note callout, using directive syntax.
:::

:::tip
This is a tip callout.
:::

:::important
This is an important callout.
:::

:::warning
This is a warning callout.
:::

:::caution
This is a caution callout.
:::

:::tip[A Custom Labelled Title]
This callout uses `[Label]` syntax to override its default title.
:::

:::this-directive-is-not-a-known-callout-kind
This directive isn't a recognised callout kind or alias, so it must pass
through untouched as a plain `<div>` rather than being dropped.
:::

## Code Blocks

A long, line-numbered TypeScript block with a filename:

```ts title="src/agents/support-agent.ts"
import { Agent } from "aniki-sdk";

export const supportAgent = new Agent({
  name: "support-agent",
  model: "claude-sonnet-5",
  instructions: "Help users troubleshoot Aniki SDK integration issues.",
  tools: [],
});

export async function handleMessage(message: string): Promise<string> {
  const response = await supportAgent.run(message);
  return response.text;
}
```

A bash block - commands are copied whole, so no line numbers:

```bash
npm install aniki-sdk
npm run build
```

A TypeScript block that explicitly opts out of line numbers:

```ts noLineNumbers
const quick = "no line numbers here, even though it's multi-line";
console.log(quick);
```

An unknown language, which must fall back to plain text rather than
failing the build:

```definitely-not-a-real-language
this block has no matching Shiki grammar
```

A single-line block, too short to benefit from line numbers:

```ts
const single = true;
```
