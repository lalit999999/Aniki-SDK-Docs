/**
 * Rewrites relative `.md` links and annotates external links, on the
 * hast tree `remark-rehype` produces (D13).
 *
 * `content/docs` has 171 links of the form `](./other-doc.md)` or
 * `](./other-doc.md#anchor)` - relative to how the source files sit next
 * to each other on disk, not to the `/docs/<slug>` routes they're served
 * at. Left alone, every one of those links would 404.
 *
 * | Input `href`                          | Output                              |
 * | -------------------------------------- | ------------------------------------ |
 * | `./tools.md`                           | `/docs/tools`                        |
 * | `./tools.md#the-openai-limitation`     | `/docs/tools#the-openai-limitation`  |
 * | `./README.md`                          | `/docs`                              |
 * | `#anchor`                               | unchanged                            |
 * | `/anything`                             | unchanged                            |
 * | `https://…`                             | unchanged href, `target="_blank"`, `rel="noopener noreferrer"`, `data-external=""` |
 * | `mailto:` / `tel:`                      | unchanged                            |
 * | anything unparseable                    | unchanged, never throws              |
 *
 * Deliberately uses string operations rather than `node:path`, so the
 * plugin has no dependency on running in a Node environment.
 */

import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const EXTERNAL_HREF_PATTERN = /^https?:\/\//i;
const RELATIVE_MD_PATTERN = /^\.\//;
const MD_EXTENSION_PATTERN = /\.md$/i;

/**
 * Options for {@link rehypeDocLinks}.
 */
export interface RehypeDocLinksOptions {
  /** Every known doc slug. When supplied, a rewritten link whose target
   * slug isn't in this list gets `data-unresolved=""` so the UI can flag
   * a broken cross-link - the link is still rewritten either way. */
  knownSlugs?: readonly string[];
}

type LinkRewrite =
  | { kind: "unchanged" }
  | { kind: "external" }
  | { kind: "resolved"; href: string; slug: string };

/**
 * Resolves a single `href` per the table above. Never throws - an
 * `href` this function can't confidently rewrite is returned unchanged.
 */
function resolveHref(href: string): LinkRewrite {
  if (
    href.startsWith("#") ||
    href.startsWith("/") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return { kind: "unchanged" };
  }

  if (EXTERNAL_HREF_PATTERN.test(href)) {
    return { kind: "external" };
  }

  if (!RELATIVE_MD_PATTERN.test(href)) {
    return { kind: "unchanged" };
  }

  const hashIndex = href.indexOf("#");
  const pathPart = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : href.slice(hashIndex);

  if (!MD_EXTENSION_PATTERN.test(pathPart)) {
    return { kind: "unchanged" };
  }

  const withoutPrefix = pathPart.slice(2);
  const segments = withoutPrefix.split("/");
  const fileName = segments[segments.length - 1];
  if (fileName === undefined || fileName.length === 0) {
    return { kind: "unchanged" };
  }

  const withoutExtension = fileName.replace(MD_EXTENSION_PATTERN, "").toLowerCase();
  const slug = withoutExtension === "readme" ? "index" : withoutExtension;
  const route = slug === "index" ? "/docs" : `/docs/${slug}`;

  return { kind: "resolved", href: route + fragment, slug };
}

/**
 * A typed rehype plugin that rewrites doc-relative links and annotates
 * external ones. Runs after `remark-rehype`, since it operates on hast
 * `<a>` elements rather than mdast `link` nodes.
 *
 * @example
 * ```ts
 * unified().use(remarkRehype).use(rehypeDocLinks, { knownSlugs: await getDocSlugs() })
 * ```
 */
const rehypeDocLinks: Plugin<[RehypeDocLinksOptions?], Root> = (options = {}) => {
  const { knownSlugs } = options;

  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") {
        return;
      }

      const href = node.properties.href;
      if (typeof href !== "string") {
        return;
      }

      const rewrite = resolveHref(href);

      if (rewrite.kind === "external") {
        node.properties.target = "_blank";
        node.properties.rel = ["noopener", "noreferrer"];
        node.properties["data-external"] = "";
        return;
      }

      if (rewrite.kind === "resolved") {
        node.properties.href = rewrite.href;
        if (knownSlugs !== undefined && !knownSlugs.includes(rewrite.slug)) {
          node.properties["data-unresolved"] = "";
        }
      }
    });
  };
};

export default rehypeDocLinks;
