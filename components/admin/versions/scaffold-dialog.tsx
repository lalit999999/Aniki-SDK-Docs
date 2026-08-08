"use client";

import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { VERSION_ID_PATTERN } from "@/lib/versions";

/** A source-version option, as much as the dialog needs from `getVersions()`. */
export interface ScaffoldSourceVersion {
  id: string;
  label: string;
  releasedAt: string;
  status: "latest" | "maintenance" | "deprecated";
}

interface FormState {
  id: string;
  label: string;
  releasedAt: string;
  sourceVersionId: string;
  promoteToLatest: boolean;
  migrationGuideSlug: string;
}

function initialFormState(sourceVersions: readonly ScaffoldSourceVersion[]): FormState {
  return {
    id: "",
    label: "",
    releasedAt: "",
    sourceVersionId: sourceVersions[0]?.id ?? "",
    promoteToLatest: false,
    migrationGuideSlug: "",
  };
}

/**
 * Mirrors the syncable checks in `validateNewVersionInput` (id pattern,
 * uniqueness, label presence, `releasedAt` format/ordering, source
 * existence) client-side, for live feedback as the form is filled in.
 * `migrationGuideSlug` resolution needs a filesystem read, so it can only
 * be checked after submit - the server response's `issues` cover that.
 */
function validateClientSide(form: FormState, sourceVersions: readonly ScaffoldSourceVersion[]): string[] {
  const issues: string[] = [];
  const knownIds = new Set(sourceVersions.map((version) => version.id));
  const newestReleasedAt = sourceVersions.reduce(
    (max, version) => (version.releasedAt > max ? version.releasedAt : max),
    "",
  );

  if (form.id.length > 0 && !VERSION_ID_PATTERN.test(form.id)) {
    issues.push(`"${form.id}" is not a valid version id (expected e.g. "v2", "v1.1")`);
  } else if (knownIds.has(form.id)) {
    issues.push(`version id "${form.id}" already exists`);
  }

  if (form.label.trim().length === 0) {
    issues.push("label must not be empty");
  }

  if (form.releasedAt.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(form.releasedAt)) {
    issues.push("releasedAt must be in YYYY-MM-DD format");
  } else if (form.releasedAt.length > 0 && form.releasedAt <= newestReleasedAt) {
    issues.push(`releasedAt must be newer than the current newest version (${newestReleasedAt})`);
  }

  if (!knownIds.has(form.sourceVersionId)) {
    issues.push("choose a source version to copy content from");
  }

  return issues;
}

/**
 * The `/admin/versions` "New version" dialog: id, label, release date,
 * source version, and a promote-to-latest switch, with live validation
 * mirroring `validateNewVersionInput` and a concrete before/after of the
 * canonical URL and redirect table (T4) once promotion is toggled on.
 * After a successful scaffold, `config/versions.ts` was rewritten at
 * module scope and `next.config.ts` derives its redirect table from it at
 * build time (T2/T4) - neither takes effect until the dev server restarts,
 * so the success state says that plainly rather than implying a refresh
 * is enough.
 */
export function ScaffoldDialog({
  sourceVersions,
  disabled,
}: {
  sourceVersions: readonly ScaffoldSourceVersion[];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => initialFormState(sourceVersions));
  const [submitting, setSubmitting] = useState(false);
  const [serverIssues, setServerIssues] = useState<string[] | null>(null);
  const [result, setResult] = useState<{ id: string } | null>(null);

  const clientIssues = useMemo(() => validateClientSide(form, sourceVersions), [form, sourceVersions]);
  const currentLatest = sourceVersions.find((version) => version.status === "latest");

  function resetAndClose(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setForm(initialFormState(sourceVersions));
      setServerIssues(null);
      setResult(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (clientIssues.length > 0) {
      return;
    }

    setSubmitting(true);
    setServerIssues(null);
    try {
      const response = await fetch("/api/admin/versions/scaffold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          label: form.label,
          releasedAt: form.releasedAt,
          sourceVersionId: form.sourceVersionId,
          promoteToLatest: form.promoteToLatest,
          migrationGuideSlug: form.migrationGuideSlug.trim().length > 0 ? form.migrationGuideSlug.trim() : undefined,
        }),
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const issues =
          body !== null && typeof body === "object" && "issues" in body && Array.isArray(body.issues)
            ? (body.issues as string[])
            : [`request failed with status ${response.status}`];
        setServerIssues(issues);
        return;
      }

      setResult({ id: form.id });
    } catch {
      setServerIssues(["request failed - check your network connection and try again"]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>New version</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {result !== null ? (
          <>
            <DialogHeader>
              <DialogTitle>Version {result.id} scaffolded</DialogTitle>
              <DialogDescription>
                <code>config/versions.ts</code> and <code>content/docs/{result.id}</code> were written together.
              </DialogDescription>
            </DialogHeader>
            <Alert>
              <AlertTitle>Restart your dev server</AlertTitle>
              <AlertDescription>
                <code>config/versions.ts</code> is imported at module scope, and <code>next.config.ts</code> derives
                its redirect table from it at build time. Neither picks up this change until the dev server (or the
                next build) restarts.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={() => resetAndClose(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>New documentation version</DialogTitle>
              <DialogDescription>
                Copies an existing version&apos;s content directory and adds a matching registry entry, atomically.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="my-4">
              <Field>
                <FieldLabel htmlFor="scaffold-id">Version id</FieldLabel>
                <Input
                  id="scaffold-id"
                  placeholder="v2"
                  value={form.id}
                  onChange={(event) => setForm((prev) => ({ ...prev, id: event.target.value }))}
                />
                <FieldDescription>Directory-safe, e.g. &quot;v2&quot; or &quot;v1.1&quot;.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="scaffold-label">Label</FieldLabel>
                <Input
                  id="scaffold-label"
                  placeholder="v2.0"
                  value={form.label}
                  onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="scaffold-released-at">Release date</FieldLabel>
                <Input
                  id="scaffold-released-at"
                  type="date"
                  value={form.releasedAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, releasedAt: event.target.value }))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="scaffold-source">Copy content from</FieldLabel>
                <NativeSelect
                  id="scaffold-source"
                  value={form.sourceVersionId}
                  onChange={(event) => setForm((prev) => ({ ...prev, sourceVersionId: event.target.value }))}
                >
                  {sourceVersions.map((version) => (
                    <NativeSelectOption key={version.id} value={version.id}>
                      {version.label} ({version.id})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel htmlFor="scaffold-promote">Promote to latest</FieldLabel>
                <Switch
                  id="scaffold-promote"
                  checked={form.promoteToLatest}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, promoteToLatest: checked }))}
                />
              </Field>

              {form.promoteToLatest && currentLatest !== undefined ? (
                <Alert variant="destructive">
                  <AlertTitle>This rewrites the canonical URLs</AlertTitle>
                  <AlertDescription>
                    <p>
                      Before: <code>/docs/*</code> serves {currentLatest.label} ({currentLatest.id}); {currentLatest.id}
                      &apos;s prefixed URLs don&apos;t exist.
                    </p>
                    <p>
                      After: <code>/docs/*</code> serves {form.label || form.id || "the new version"};{" "}
                      <code>{`/docs/${currentLatest.id}/*`}</code> permanently redirects to the new unprefixed URLs.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : null}

              <Field>
                <FieldLabel htmlFor="scaffold-migration-guide">Migration guide slug (optional)</FieldLabel>
                <Input
                  id="scaffold-migration-guide"
                  placeholder="migrating-to-v2"
                  value={form.migrationGuideSlug}
                  onChange={(event) => setForm((prev) => ({ ...prev, migrationGuideSlug: event.target.value }))}
                />
                <FieldDescription>
                  Must resolve to a real page in the copied content, or leave it blank.
                </FieldDescription>
              </Field>

              <FieldError errors={[...clientIssues, ...(serverIssues ?? [])].map((message) => ({ message }))} />
            </FieldGroup>

            <DialogFooter>
              <Button type="submit" disabled={submitting || clientIssues.length > 0}>
                {submitting ? "Scaffolding…" : "Scaffold version"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
