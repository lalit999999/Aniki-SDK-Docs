"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminContentErrorBody {
  readonly error?: { readonly message?: string };
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as AdminContentErrorBody;
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Row actions for a single document in the content table: an edit link,
 * an optimistic publish/unpublish toggle (D6), and a delete action gated
 * behind typed-slug confirmation (D8) - deleting a docs page is
 * destructive and unrecoverable from within the panel, so the same
 * confirmation the API itself requires (the body's `slug` must match the
 * route param) is enforced here before the request is even sent.
 */
export function DocumentActions({
  version,
  slug,
  draft,
}: {
  readonly version: string;
  readonly slug: string;
  readonly draft: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");

  function handlePublishToggle(): void {
    const action = draft ? "publish" : "unpublish";
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/content/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version, slug, action }),
        });
        if (!response.ok) {
          throw new Error(await extractErrorMessage(response, `failed to ${action} "${slug}"`));
        }
        toast.success(action === "publish" ? `Published "${slug}"` : `Unpublished "${slug}"`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `failed to ${action} "${slug}"`);
      }
    });
  }

  function handleDelete(): void {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/content/${version}/${slug}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: confirmSlug }),
        });
        if (!response.ok) {
          throw new Error(await extractErrorMessage(response, `failed to delete "${slug}"`));
        }
        toast.success(`Deleted "${slug}"`);
        setDeleteOpen(false);
        setConfirmSlug("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `failed to delete "${slug}"`);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/content/${version}/${slug}`}>Edit</Link>
      </Button>
      <Button variant="ghost" size="sm" disabled={isPending} onClick={handlePublishToggle}>
        {draft ? "Publish" : "Unpublish"}
      </Button>
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setConfirmSlug("");
          }
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{slug}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the page from <span className="font-mono">content/docs</span> and
              cannot be undone from within the panel. Type <span className="font-mono">{slug}</span> below
              to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`confirm-delete-${version}-${slug}`} className="sr-only">
              Type &quot;{slug}&quot; to confirm deletion
            </Label>
            <Input
              id={`confirm-delete-${version}-${slug}`}
              value={confirmSlug}
              onChange={(event) => setConfirmSlug(event.target.value)}
              placeholder={slug}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={confirmSlug !== slug || isPending}
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
