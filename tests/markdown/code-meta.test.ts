/**
 * Unit tests for remark-code-meta's D7 line-number rules, asserted
 * directly against the mdast `code` node it produces (no need to run the
 * full pipeline through Shiki for this - see pipeline.test.ts for that).
 */
import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Code, Root } from "mdast";

import remarkCodeMeta from "@/lib/markdown/plugins/remark-code-meta";

function parseCode(markdown: string): Code {
  const processor = unified().use(remarkParse).use(remarkCodeMeta);
  const tree = processor.runSync(processor.parse(markdown)) as Root;
  const [node] = tree.children;
  if (node === undefined || node.type !== "code") {
    throw new Error("expected the first node to be a code block");
  }
  return node;
}

describe("remark-code-meta", () => {
  it("appends showLineNumbers for a multi-line ts block", () => {
    const node = parseCode("```ts\nconst a = 1;\nconst b = 2;\n```");
    expect(node.lang).toBe("ts");
    expect(node.meta).toBe("showLineNumbers");
  });

  it("does not append showLineNumbers for a multi-line bash block", () => {
    const node = parseCode("```bash\necho hi\necho bye\n```");
    expect(node.meta).toBeNull();
  });

  it("does not append showLineNumbers for a single-line block", () => {
    const node = parseCode("```ts\nconst a = 1;\n```");
    expect(node.meta).toBeNull();
  });

  it("strips the noLineNumbers token and suppresses line numbers", () => {
    const node = parseCode("```ts noLineNumbers\nconst a = 1;\nconst b = 2;\n```");
    expect(node.meta).toBeNull();
  });

  it("preserves a title=\"…\" meta string alongside showLineNumbers", () => {
    const node = parseCode('```ts title="src/index.ts"\nconst a = 1;\nconst b = 2;\n```');
    expect(node.meta).toBe('title="src/index.ts" showLineNumbers');
  });

  it("normalizes an unknown language to text", () => {
    const node = parseCode("```typescrpt\nconst a = 1;\nconst b = 2;\n```");
    expect(node.lang).toBe("text");
  });

  it("does not add line numbers to an unknown-language block", () => {
    const node = parseCode("```typescrpt\nconst a = 1;\nconst b = 2;\n```");
    expect(node.meta).toBeNull();
  });

  it.each(["bash", "sh", "shell", "zsh", "console", "text", "plaintext", "diff"])(
    "excludes the %s language from line numbers",
    (lang) => {
      const node = parseCode(`\`\`\`${lang}\nline one\nline two\n\`\`\``);
      expect(node.meta).toBeNull();
    },
  );
});
