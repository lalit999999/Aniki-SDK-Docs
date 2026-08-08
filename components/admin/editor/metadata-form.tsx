"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { DocCategory, DocFrontmatter } from "@/lib/content";

function FieldIssues({ issues }: { readonly issues: readonly string[] | undefined }) {
  if (issues === undefined || issues.length === 0) {
    return null;
  }
  return <FieldError>{issues.join("; ")}</FieldError>;
}

/**
 * Every `DocFrontmatter` field, fully controlled - the editor page owns
 * the working draft and passes it down as `frontmatter`/`onChange` so this
 * component has no state of its own beyond the tag-input's staging text.
 *
 * `category` is driven entirely by the `categories` prop (T8) - it always
 * traces back to `DOC_CATEGORIES` in `lib/content`, computed server-side
 * and passed down, never hardcoded here. `replacedBy` is a `<Select>` over
 * `siblingSlugs` rather than free text (T3): the writer's index-integrity
 * check would reject a dangling pointer anyway, but offering only real
 * slugs means that failure mode simply can't occur from this form.
 * `deprecatedSince`/`deprecatedReason`/`replacedBy` are disabled - and
 * cleared back to `undefined` - the instant `deprecated` is switched off
 * (T4), mirroring the server's own cross-field validation instead of
 * letting the client submit a combination the server will just reject.
 */
export function MetadataForm({
  frontmatter,
  onChange,
  categories,
  siblingSlugs,
  errors,
}: {
  readonly frontmatter: DocFrontmatter;
  readonly onChange: (next: DocFrontmatter) => void;
  readonly categories: readonly DocCategory[];
  readonly siblingSlugs: readonly string[];
  readonly errors: Readonly<Record<string, readonly string[]>>;
}) {
  const [pendingTag, setPendingTag] = useState("");
  const tags = frontmatter.tags ?? [];

  function patch(partial: Partial<DocFrontmatter>): void {
    onChange({ ...frontmatter, ...partial });
  }

  function addTag(): void {
    const value = pendingTag.trim();
    if (value.length === 0 || tags.includes(value)) {
      setPendingTag("");
      return;
    }
    patch({ tags: [...tags, value] });
    setPendingTag("");
  }

  function removeTag(tag: string): void {
    patch({ tags: tags.filter((existing) => existing !== tag) });
  }

  function setDeprecated(next: boolean): void {
    if (next) {
      patch({ deprecated: true });
    } else {
      patch({ deprecated: false, deprecatedSince: undefined, deprecatedReason: undefined, replacedBy: undefined });
    }
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="doc-title">Title</FieldLabel>
        <FieldContent>
          <Input
            id="doc-title"
            value={frontmatter.title}
            onChange={(event) => patch({ title: event.target.value })}
            aria-invalid={errors.title !== undefined}
            required
          />
          <FieldIssues issues={errors.title} />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor="doc-description">Description</FieldLabel>
        <FieldContent>
          <Input
            id="doc-description"
            value={frontmatter.description}
            onChange={(event) => patch({ description: event.target.value })}
            aria-invalid={errors.description !== undefined}
            required
          />
          <FieldIssues issues={errors.description} />
        </FieldContent>
      </Field>

      <Field orientation="responsive">
        <FieldLabel htmlFor="doc-category">Category</FieldLabel>
        <FieldContent>
          <Select value={frontmatter.category} onValueChange={(value) => patch({ category: value as DocCategory })}>
            <SelectTrigger id="doc-category">
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
          <FieldIssues issues={errors.category} />
        </FieldContent>
      </Field>

      <Field orientation="responsive">
        <FieldLabel htmlFor="doc-order">Order</FieldLabel>
        <FieldContent>
          <Input
            id="doc-order"
            type="number"
            min={0}
            value={frontmatter.order}
            onChange={(event) => patch({ order: Number(event.target.value) })}
          />
          <FieldIssues issues={errors.order} />
        </FieldContent>
      </Field>

      <Field orientation="responsive">
        <FieldLabel htmlFor="doc-updated">Updated</FieldLabel>
        <FieldContent>
          <Input
            id="doc-updated"
            type="date"
            value={frontmatter.updated ?? ""}
            onChange={(event) => patch({ updated: event.target.value.length > 0 ? event.target.value : undefined })}
          />
          <FieldDescription>Publishing stamps this automatically; edit it directly only to backdate a page.</FieldDescription>
          <FieldIssues issues={errors.updated} />
        </FieldContent>
      </Field>

      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="doc-draft">Draft</FieldLabel>
          <FieldDescription>Hidden from the live site in production until published.</FieldDescription>
        </FieldContent>
        <Switch id="doc-draft" checked={frontmatter.draft ?? false} onCheckedChange={(checked) => patch({ draft: checked })} />
      </Field>

      <Field>
        <FieldLabel htmlFor="doc-tags">Tags</FieldLabel>
        <FieldContent>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove tag "${tag}"`}
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              id="doc-tags"
              value={pendingTag}
              onChange={(event) => setPendingTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add a tag and press Enter"
            />
            <Button type="button" variant="outline" size="sm" onClick={addTag}>
              Add
            </Button>
          </div>
          <FieldIssues issues={errors.tags} />
        </FieldContent>
      </Field>

      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="doc-deprecated">Deprecated</FieldLabel>
          <FieldDescription>Enables the fields below, which are cleared when this is off.</FieldDescription>
        </FieldContent>
        <Switch id="doc-deprecated" checked={frontmatter.deprecated ?? false} onCheckedChange={setDeprecated} />
      </Field>

      <Field orientation="responsive">
        <FieldLabel htmlFor="doc-deprecated-since">Deprecated since</FieldLabel>
        <FieldContent>
          <Input
            id="doc-deprecated-since"
            type="date"
            disabled={!frontmatter.deprecated}
            value={frontmatter.deprecatedSince ?? ""}
            onChange={(event) =>
              patch({ deprecatedSince: event.target.value.length > 0 ? event.target.value : undefined })
            }
          />
          <FieldIssues issues={errors.deprecatedSince} />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor="doc-deprecated-reason">Deprecation reason</FieldLabel>
        <FieldContent>
          <Input
            id="doc-deprecated-reason"
            disabled={!frontmatter.deprecated}
            value={frontmatter.deprecatedReason ?? ""}
            onChange={(event) =>
              patch({ deprecatedReason: event.target.value.length > 0 ? event.target.value : undefined })
            }
          />
          <FieldIssues issues={errors.deprecatedReason} />
        </FieldContent>
      </Field>

      <Field orientation="responsive">
        <FieldLabel htmlFor="doc-replaced-by">Replaced by</FieldLabel>
        <FieldContent>
          <Select
            value={frontmatter.replacedBy ?? ""}
            onValueChange={(value) => patch({ replacedBy: value.length > 0 ? value : undefined })}
            disabled={!frontmatter.deprecated || siblingSlugs.length === 0}
          >
            <SelectTrigger id="doc-replaced-by">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {siblingSlugs.map((sibling) => (
                <SelectItem key={sibling} value={sibling}>
                  {sibling}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldIssues issues={errors.replacedBy} />
        </FieldContent>
      </Field>

      <Field orientation="responsive">
        <FieldLabel htmlFor="doc-since">Since</FieldLabel>
        <FieldContent>
          <Input
            id="doc-since"
            value={frontmatter.since ?? ""}
            onChange={(event) => patch({ since: event.target.value.length > 0 ? event.target.value : undefined })}
            placeholder="v1"
          />
          <FieldIssues issues={errors.since} />
        </FieldContent>
      </Field>
    </FieldGroup>
  );
}
