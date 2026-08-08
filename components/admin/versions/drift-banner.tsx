import { Alert01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { hasDrift } from "@/lib/admin/versions";
import type { VersionDriftReport } from "@/lib/admin/versions";

/**
 * Unmissable, rendered-first banner naming every drifted path (T1) when
 * the declared registry and `content/docs` disagree. `next build` fails
 * the moment this is non-empty and `scaffoldVersion` refuses to run, so
 * the copy says both things plainly rather than leaving a human to
 * discover them separately.
 */
export function DriftBanner({ drift }: { drift: VersionDriftReport }) {
  if (!hasDrift(drift)) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-8">
      <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} />
      <AlertTitle>Registry and content directories disagree</AlertTitle>
      <AlertDescription>
        <p>
          <code>next build</code> will fail until every path below is resolved, and scaffolding a new version is
          refused until then too.
        </p>
        {drift.declaredWithoutDirectory.length > 0 ? (
          <div>
            <p className="font-medium text-foreground">Declared with no directory:</p>
            <ul className="ml-4 list-disc">
              {drift.declaredWithoutDirectory.map((id) => (
                <li key={id}>
                  <code>{id}</code> is declared in <code>config/versions.ts</code> but{" "}
                  <code>{`content/docs/${id}`}</code> doesn&apos;t exist.
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {drift.directoryWithoutDeclaration.length > 0 ? (
          <div>
            <p className="font-medium text-foreground">Directory with no declared version:</p>
            <ul className="ml-4 list-disc">
              {drift.directoryWithoutDeclaration.map((name) => (
                <li key={name}>
                  <code>{`content/docs/${name}`}</code> exists but has no matching entry in{" "}
                  <code>config/versions.ts</code>.
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
