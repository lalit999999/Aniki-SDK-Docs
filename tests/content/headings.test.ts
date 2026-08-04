import { describe, expect, it } from "vitest";

import { extractHeadings, extractLeadingH1, parseMarkdown, stripLeadingH1 } from "@/lib/content/headings";

const FENCED_PSEUDO_HEADINGS = `# Installation

## Installing the package

\`\`\`bash
# pnpm
pnpm add aniki-sdk

# yarn
yarn add aniki-sdk

# bun
bun add aniki-sdk
\`\`\`
`;

describe("extractHeadings", () => {
  it("ignores '#'-prefixed lines inside fenced code blocks", () => {
    const tree = parseMarkdown(FENCED_PSEUDO_HEADINGS, "fixture.md");
    const headings = extractHeadings(tree);

    expect(headings.map((heading) => heading.text)).not.toContain("pnpm");
    expect(headings.map((heading) => heading.text)).not.toContain("yarn");
    expect(headings.map((heading) => heading.text)).not.toContain("bun");
    expect(headings).toHaveLength(1);
    expect(headings[0]?.text).toBe("Installing the package");
  });

  it("excludes H1 by default", () => {
    const tree = parseMarkdown("# Title\n\n## Section\n", "fixture.md");
    const headings = extractHeadings(tree);
    expect(headings.map((heading) => heading.text)).not.toContain("Title");
    expect(headings).toHaveLength(1);
    expect(headings[0]?.level).toBe(2);
  });
});

describe("extractLeadingH1", () => {
  it("returns the text of a leading H1", () => {
    const tree = parseMarkdown("# Guides\n\nBody.", "fixture.md");
    expect(extractLeadingH1(tree)).toBe("Guides");
  });

  it("returns null when the document doesn't start with an H1", () => {
    const tree = parseMarkdown("Body only.\n\n## Section\n", "fixture.md");
    expect(extractLeadingH1(tree)).toBeNull();
  });

  it("returns null for an H1 that isn't the first node", () => {
    const tree = parseMarkdown("Intro paragraph.\n\n# Not the title\n", "fixture.md");
    expect(extractLeadingH1(tree)).toBeNull();
  });
});

describe("stripLeadingH1", () => {
  it("removes a leading H1 and leaves the rest untouched", () => {
    expect(stripLeadingH1("# Guides\n\nBody text.\n")).toBe("Body text.\n");
  });

  it("leaves content unchanged when there's no leading H1", () => {
    const source = "Body text with no heading.\n";
    expect(stripLeadingH1(source)).toBe(source);
  });

  it("never touches an H1 that appears later in the document", () => {
    const source = "Intro.\n\n# Later heading\n\nMore text.\n";
    expect(stripLeadingH1(source)).toBe(source);
  });
});
