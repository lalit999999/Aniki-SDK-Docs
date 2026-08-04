import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon } from "@hugeicons/core-free-icons";

import { siteConfig } from "@/config/site";

/**
 * Links to the source markdown file for the current document on GitHub.
 * The URL is built from `siteConfig`, never hardcoded per page.
 */
export function EditOnGithub({ slug }: { slug: string }) {
  const fileName = slug === "index" ? "README" : slug;
  const href = `${siteConfig.links.docsRepo}/edit/main/content/docs/${fileName}.md`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <HugeiconsIcon icon={GithubIcon} strokeWidth={2} className="size-3.5" />
      Edit this page on GitHub
    </a>
  );
}
