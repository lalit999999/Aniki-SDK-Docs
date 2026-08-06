import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon } from "@hugeicons/core-free-icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { findDocBySlug } from "@/lib/content";
import type { DocMeta } from "@/lib/content";

/**
 * Banner shown at the top of a single deprecated page (D9) - distinct from
 * `VersionNotice`, which flags an entire version regardless of whether any
 * given page within it is deprecated. A Server Component so the
 * `replacedBy` link can be resolved to a real, verified route rather than
 * assumed (the loader already guarantees `replacedBy` resolves to a real
 * slug at index-build time, but resolving it here keeps this component
 * correct even if that invariant ever changes).
 *
 * Renders nothing when `meta.deprecated` is `false`.
 */
export async function DeprecationNotice({ meta }: { meta: DocMeta }) {
  if (!meta.deprecated) {
    return null;
  }

  const replacement = meta.replacedBy !== null ? await findDocBySlug(meta.replacedBy, meta.version) : null;

  return (
    <Alert role="alert" variant="destructive" className="mb-6">
      <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} />
      <AlertTitle>This page is deprecated</AlertTitle>
      <AlertDescription>
        <p>
          {meta.deprecatedReason ?? "This page is no longer maintained."}
          {meta.deprecatedSince !== null && ` Deprecated since ${meta.deprecatedSince}.`}
          {replacement !== null && (
            <>
              {" "}
              See <Link href={replacement.meta.route}>{replacement.meta.title}</Link> instead.
            </>
          )}
        </p>
      </AlertDescription>
    </Alert>
  );
}
