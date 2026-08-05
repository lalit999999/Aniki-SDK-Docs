import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon } from "@hugeicons/core-free-icons";

import { siteConfig } from "@/config/site";

/**
 * Links to the source markdown file for the current document on GitHub.
 * The URL is built from `siteConfig` and the document's own
 * `meta.filePath` (repo-relative, e.g. `content/docs/v1/introduction.md`) -
 * that's already correct for whichever version the document belongs to,
 * which deletes the old `README`/`index` special-casing this component
 * used to need when it only had a bare slug to work from.
 */
export function EditOnGithub({ filePath }: { filePath: string }) {
  const href = `${siteConfig.links.docsRepo}/edit/main/${filePath}`;

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
