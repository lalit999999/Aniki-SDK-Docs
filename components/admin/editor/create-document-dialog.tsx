"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { VERSION_ID_PATTERN } from "@/lib/versions";
import type { DocCategory } from "@/lib/content";

/** Mirrors `FILE_SLUG_PATTERN` in `lib/content/slug.ts` and
 * `lib/admin/content/paths.ts` (T1) - neither module exports it for a
 * Client Component to import, since both live behind `server-only` (T10),
 * so this is a deliberate hand-kept copy for live client-side feedback
 * only. The server re-validates authoritatively via `validateSlugInput`
 * on every write; a mismatch here can only under-warn, never under-reject. */
const FILE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$|^index$/;

function validateSlugClientSide(slug: string): string[] {
  const issues: string[] = [];
  if (slug.length === 0) {
    return issues;
  }
  if (/[A-Z]/.test(slug)) issues.push("must not contain uppercase letters");
  if (/\s/.test(slug)) issues.push("must not contain whitespace");
  if (slug.startsWith("-")) issues.push("must not start with a hyphen");
  if (slug.length > 1 && slug.endsWith("-")) issues.push("must not end with a hyphen");
  if (slug.includes("--")) issues.push("must not contain consecutive hyphens");
  if (!FILE_SLUG_PATTERN.test(slug)) {
    issues.push('must be lowercase, hyphen-separated words (e.g. "quick-start"), or "index"');
  }
  if (VERSION_ID_PATTERN.test(slug)) {
    issues.push(`"${slug}" is reserved - it matches the documentation version id pattern (e.g. "v1", "v2.1")`);
  }
  return issues;
}

interface AdminContentErrorBody {
  readonly error?: { readonly message?: string; readonly issues?: readonly string[] };
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as AdminContentErrorBody;
    const issues = body.error?.issues;
    if (issues !== undefined && issues.length > 0) {
      return issues.join("; ");
    }
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * "New document" dialog: slug, title, description, category (driven by the
 * server-supplied `categories` prop, T8 - never hardcoded here), order, and
 * a start-as-draft toggle. Live slug validation runs on every keystroke for
 * immediate feedback; the reserved-version-id case gets its own message
 * rather than folding into the generic pattern-mismatch one, since "why is
 * my slug rejected" is a much easier question to answer when the reason is
 * spelled out. The real, authoritative check still happens server-side on
 * submit (`createDocument`'s `validateDocument`).
 */
export function CreateDocumentDialog({
  version,
  categories,
  existingSlugs,
}: {
  readonly version: string;
  readonly categories: readonly DocCategory[];
  readonly existingSlugs: readonly string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DocCategory>(categories[0] ?? "Reference");
  const [order, setOrder] = useState(0);
  const [startAsDraft, setStartAsDraft] = useState(true);
  const [serverIssues, setServerIssues] = useState<string[]>([]);

  const slugIssues = validateSlugClientSide(slug);
  const isDuplicate = slug.length > 0 && existingSlugs.includes(slug);
  const canSubmit =
    slug.length > 0 &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    slugIssues.length === 0 &&
    !isDuplicate &&
    !submitting;

  function resetForm(): void {
    setSlug("");
    setTitle("");
    setDescription("");
    setCategory(categories[0] ?? "Reference");
    setOrder(0);
    setStartAsDraft(true);
    setServerIssues([]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setServerIssues([]);
    try {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version,
          slug,
          frontmatter: { title, description, category, order, draft: startAsDraft },
          body: `# ${title}\n\n`,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as AdminContentErrorBody | null;
        if (body?.error?.issues !== undefined && body.error.issues.length > 0) {
          setServerIssues([...body.error.issues]);
        }
        throw new Error(await extractErrorMessage(response, "failed to create document"));
      }

      toast.success(`Created "${slug}"`);
      setOpen(false);
      resetForm();
      router.push(`/admin/content/${version}/${slug}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "failed to create document");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>New document</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New document</DialogTitle>
          <DialogDescription>Adds a page to version &quot;{version}&quot;.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-doc-slug">Slug</FieldLabel>
              <FieldContent>
                <Input
                  id="new-doc-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="quick-start"
                  autoComplete="off"
                  aria-invalid={slugIssues.length > 0 || isDuplicate}
                  required
                />
                {isDuplicate && <FieldError>a document with this slug already exists</FieldError>}
                {slugIssues.length > 0 && (
                  <FieldError>
                    <ul className="ml-4 list-disc">
                      {slugIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </FieldError>
                )}
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="new-doc-title">Title</FieldLabel>
              <FieldContent>
                <Input id="new-doc-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="new-doc-description">Description</FieldLabel>
              <FieldContent>
                <Input
                  id="new-doc-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                />
              </FieldContent>
            </Field>

            <Field orientation="responsive">
              <FieldLabel htmlFor="new-doc-category">Category</FieldLabel>
              <FieldContent>
                <Select value={category} onValueChange={(value) => setCategory(value as DocCategory)}>
                  <SelectTrigger id="new-doc-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field orientation="responsive">
              <FieldLabel htmlFor="new-doc-order">Order</FieldLabel>
              <FieldContent>
                <Input
                  id="new-doc-order"
                  type="number"
                  min={0}
                  value={order}
                  onChange={(event) => setOrder(Number(event.target.value))}
                />
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="new-doc-draft">Start as draft</FieldLabel>
                <FieldDescription>Draft pages are hidden from the live site until published.</FieldDescription>
              </FieldContent>
              <Switch id="new-doc-draft" checked={startAsDraft} onCheckedChange={setStartAsDraft} />
            </Field>

            {serverIssues.length > 0 && (
              <FieldError>
                <ul className="ml-4 list-disc">
                  {serverIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </FieldError>
            )}
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? "Creating…" : "Create document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
