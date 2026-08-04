import path from "node:path";
import { readFile } from "node:fs/promises";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/markdown/markdown";
import { getDocSlugs } from "@/lib/content";

const FIXTURE_PATH = path.join(process.cwd(), "content", "samples", "kitchen-sink.md");

/**
 * Scaffolding-only route: renders `content/samples/kitchen-sink.md`
 * through the full markdown pipeline so every Step 4 feature can be
 * checked by eye in a browser without a real docs route wired up yet.
 * 404s in production so it never ships as a real page - Step 5 replaces
 * this with `/docs/[slug]`, which renders real documents through the
 * same `<Markdown>` component.
 */
export default async function MarkdownPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [content, knownSlugs] = await Promise.all([
    readFile(FIXTURE_PATH, "utf-8"),
    getDocSlugs(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Markdown content={content} filePath="content/samples/kitchen-sink.md" knownSlugs={knownSlugs} />
    </div>
  );
}
