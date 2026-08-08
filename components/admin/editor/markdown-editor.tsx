"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DocCategory, DocFrontmatter } from "@/lib/content";
import type { DirectiveKind } from "@/lib/doc-components/types";

import { EditorToolbar } from "./editor-toolbar";
import type { ToolbarInsertion } from "./editor-toolbar";
import { MetadataForm } from "./metadata-form";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

const PREVIEW_DEBOUNCE_MS = 400;
const WORDS_PER_MINUTE = 200;
/** Mirrors `HEADING_LEVEL_2_PATTERN` in `lib/admin/content/workflow.ts`. */
const HEADING_LEVEL_2_PATTERN = /^##(?!#)\s+\S/m;

interface AdminContentErrorBody {
  readonly error?: {
    readonly message?: string;
    readonly issues?: readonly string[];
    readonly conflicts?: readonly string[];
  };
}

function frontmatterEquals(a: DocFrontmatter, b: DocFrontmatter): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Groups API-reported issues (`"field: message"`) by field name, so
 * `MetadataForm` can render each under the input it belongs to instead of
 * as one undifferentiated list. */
function groupIssuesByField(issues: readonly string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const issue of issues) {
    const separator = issue.indexOf(":");
    const field = separator === -1 ? "(root)" : issue.slice(0, separator).trim();
    const message = separator === -1 ? issue : issue.slice(separator + 1).trim();
    grouped[field] = [...(grouped[field] ?? []), message];
  }
  return grouped;
}

function estimateReadingStats(body: string): { words: number; minutes: number } {
  const withoutCode = body.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
  const trimmed = withoutCode.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  return { words, minutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)) };
}

/**
 * The three `canPublish` (`lib/admin/content/workflow.ts`) checks that
 * don't require a disk read, reimplemented client-side for a tooltip that
 * updates on every keystroke. The fourth check - a `replacedBy` that
 * resolves to a real page - is deliberately not reimplemented here: this
 * form's `replacedBy` field is a `<Select>` over real sibling slugs
 * (T3/`MetadataForm`), never free text, so that failure mode structurally
 * cannot occur from anything this UI lets an author type.
 */
function computePublishBlockers(frontmatter: DocFrontmatter, body: string): string[] {
  const reasons: string[] = [];
  if (body.trim().length === 0) {
    reasons.push("the document body is empty");
  }
  const description = frontmatter.description.trim();
  const title = frontmatter.title.trim();
  if (description.length === 0) {
    reasons.push("a description is required");
  } else if (description === title) {
    reasons.push("the description must not be identical to the title");
  }
  if (!HEADING_LEVEL_2_PATTERN.test(body)) {
    reasons.push("the document must contain at least one level-2 (##) heading");
  }
  return reasons;
}

/**
 * The editor's client-side orchestrator: owns the working draft (body +
 * frontmatter), the textarea, the toolbar, the metadata form, and the
 * save/publish flow. The live preview itself is a sibling Server
 * Component (`PreviewPane`) that `page.tsx` renders independently - this
 * component only drives it, by debouncing `body` into a `?preview=`
 * search param and calling `router.replace()` (D3). That replace is a
 * soft navigation: `page.tsx` re-executes server-side with the new
 * `body`, but this component's own state survives untouched, since
 * neither its props nor its position in the tree changed.
 *
 * `children` is that same `PreviewPane`, rendered exactly once by
 * `page.tsx` and handed down here so this component can lay it out - it
 * cannot import `PreviewPane` itself (T10: that module pulls in
 * `lib/content`, which is `server-only`). The desktop/mobile split
 * (`components/ui/resizable` vs. `components/ui/tabs`) picks one layout
 * via a `matchMedia` check and renders `children` into exactly one of
 * them, never both - putting the same element into two simultaneously
 * mounted branches would create two independent preview instances
 * instead of one relocated one.
 */
export function MarkdownEditor({
  version,
  slug,
  initialFrontmatter,
  initialBody,
  siblingSlugs,
  directives,
  categories,
  children,
}: {
  readonly version: string;
  readonly slug: string;
  readonly initialFrontmatter: DocFrontmatter;
  readonly initialBody: string;
  readonly siblingSlugs: readonly string[];
  readonly directives: readonly { name: string; kind: DirectiveKind }[];
  readonly categories: readonly DocCategory[];
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window === "undefined" || window.matchMedia(DESKTOP_MEDIA_QUERY).matches,
  );

  const [frontmatter, setFrontmatter] = useState(initialFrontmatter);
  const [body, setBody] = useState(initialBody);
  const [savedFrontmatter, setSavedFrontmatter] = useState(initialFrontmatter);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [conflictPath, setConflictPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [escapeArmed, setEscapeArmed] = useState(false);

  const dirty = body !== savedBody || !frontmatterEquals(frontmatter, savedFrontmatter);
  const isDraft = savedFrontmatter.draft === true;
  const { words, minutes } = useMemo(() => estimateReadingStats(body), [body]);
  const publishBlockers = useMemo(
    () => (isDraft ? computePublishBlockers(frontmatter, body) : []),
    [isDraft, frontmatter, body],
  );

  const skipNextPreview = useRef(true);
  useEffect(() => {
    if (skipNextPreview.current) {
      skipNextPreview.current = false;
      return;
    }
    const timer = setTimeout(() => {
      router.replace(`${pathname}?preview=${encodeURIComponent(body)}`, { scroll: false });
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [body, pathname, router]);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_MEDIA_QUERY);
    function handleChange(event: MediaQueryListEvent): void {
      setIsDesktop(event.matches);
    }
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  async function performSave(): Promise<boolean> {
    setSaving(true);
    setFieldErrors({});
    setConflictPath(null);
    try {
      const response = await fetch(`/api/admin/content/${version}/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frontmatter, body }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as AdminContentErrorBody | null;
        if (response.status === 400 && payload?.error?.issues !== undefined) {
          setFieldErrors(groupIssuesByField(payload.error.issues));
          toast.error("Fix the highlighted fields and try again.");
          return false;
        }
        if (response.status === 409) {
          const conflicts = payload?.error?.conflicts;
          setConflictPath(conflicts?.[0] ?? null);
          toast.error(payload?.error?.message ?? "This document conflicts with another file.");
          return false;
        }
        toast.error(payload?.error?.message ?? "Failed to save.");
        return false;
      }

      setSavedFrontmatter(frontmatter);
      setSavedBody(body);
      toast.success("Saved");
      router.refresh();
      return true;
    } catch {
      toast.error("Failed to save.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishToggle(): Promise<void> {
    const action = isDraft ? "publish" : "unpublish";
    if (action === "publish" && publishBlockers.length > 0) {
      return;
    }
    setPublishing(true);
    try {
      if (dirty) {
        const saved = await performSave();
        if (!saved) {
          return;
        }
      }
      const response = await fetch("/api/admin/content/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, slug, action }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as AdminContentErrorBody | null;
        toast.error(payload?.error?.message ?? `Failed to ${action}.`);
        return;
      }
      setSavedFrontmatter((previous) => ({ ...previous, draft: action !== "publish" }));
      toast.success(action === "publish" ? "Published" : "Unpublished");
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  function insertAtCursor({ before, after }: ToolbarInsertion): void {
    const textarea = textareaRef.current;
    if (textarea === null) {
      return;
    }
    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const next = `${value.slice(0, selectionStart)}${before}${selected}${after}${value.slice(selectionEnd)}`;
    setBody(next);
    const cursor = selectionStart + before.length + selected.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Escape") {
      setEscapeArmed(true);
      return;
    }
    if (event.key === "Tab" && escapeArmed) {
      setEscapeArmed(false);
      return;
    }
    setEscapeArmed(false);

    if (event.key === "Tab") {
      event.preventDefault();
      const textarea = event.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;
      const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
      setBody(next);
      const cursor = selectionStart + 2;
      requestAnimationFrame(() => textarea.setSelectionRange(cursor, cursor));
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void performSave();
    }
  }

  const editorColumn = (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{words} words</span>
          <span aria-hidden="true">·</span>
          <span>{minutes} min read</span>
          <span aria-hidden="true">·</span>
          <span className={dirty ? "font-medium text-foreground" : undefined}>
            {dirty ? "Unsaved changes" : "Saved"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!dirty || saving} onClick={() => void performSave()}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {isDraft && publishBlockers.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button type="button" size="sm" disabled>
                    Publish
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <ul className="ml-3 list-disc">
                  {publishBlockers.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button type="button" size="sm" disabled={publishing} onClick={() => void handlePublishToggle()}>
              {publishing ? "Working…" : isDraft ? "Publish" : "Unpublish"}
            </Button>
          )}
        </div>
      </div>

      {conflictPath !== null && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Conflicts with <span className="font-mono">{conflictPath}</span>.
        </p>
      )}

      <MetadataForm
        frontmatter={frontmatter}
        onChange={setFrontmatter}
        categories={categories}
        siblingSlugs={siblingSlugs}
        errors={fieldErrors}
      />

      <EditorToolbar directives={directives} onInsert={insertAtCursor} />

      <Textarea
        ref={textareaRef}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck
        className="min-h-96 flex-1 font-mono text-sm"
        aria-label="Document body (Markdown)"
      />
    </div>
  );

  return (
    <div className="h-full">
      <UnsavedChangesGuard dirty={dirty} />
      {isDesktop ? (
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel defaultSize={55} minSize={30}>
            {editorColumn}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={45} minSize={20}>
            {children}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <Tabs defaultValue="editor" className="h-full">
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="editor" className="h-full">
            {editorColumn}
          </TabsContent>
          <TabsContent value="preview" className="h-full overflow-y-auto">
            {children}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
