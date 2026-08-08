"use client";

import { useMemo, useState } from "react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DocumentSummary } from "@/lib/admin/content/types";

import { DocumentActions } from "./document-actions";
import { PublishBadge } from "./publish-badge";

type StatusFilter = "all" | "published" | "draft" | "deprecated";
type SortKey = "category" | "title" | "updated";
type SortDirection = "asc" | "desc";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "deprecated", label: "Deprecated" },
];

function matchesStatus(doc: DocumentSummary, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "draft":
      return doc.draft;
    case "published":
      return !doc.draft;
    case "deprecated":
      return doc.deprecated;
  }
}

function compareDocuments(
  a: DocumentSummary,
  b: DocumentSummary,
  key: SortKey,
  direction: SortDirection,
): number {
  let result: number;
  if (key === "title") {
    result = a.title.localeCompare(b.title);
  } else if (key === "updated") {
    result = (a.updatedAt ?? "").localeCompare(b.updatedAt ?? "");
  } else {
    result = a.category.localeCompare(b.category) || a.order - b.order;
  }
  return direction === "asc" ? result : -result;
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  readonly label: string;
  readonly sortKey: SortKey;
  readonly activeKey: SortKey;
  readonly direction: SortDirection;
  readonly onSort: (key: SortKey) => void;
}) {
  const isActive = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}${isActive ? `, currently ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
      className="rounded-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      {label}
      {isActive ? (direction === "asc" ? " ↑" : " ↓") : null}
    </button>
  );
}

/**
 * The content list table: searchable by title/slug, filterable by publish
 * status, sortable by title/category+order/last-updated, with per-row
 * edit/publish/delete actions. A Client Component because search, filter,
 * and sort state all live in the browser - the underlying data is a plain
 * prop the Server Component page (`app/admin/content/page.tsx`) already
 * loaded via `listDocuments`.
 */
export function ContentTable({
  version,
  documents,
}: {
  readonly version: string;
  readonly documents: readonly DocumentSummary[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("category");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents
      .filter((doc) => matchesStatus(doc, statusFilter))
      .filter(
        (doc) =>
          query.length === 0 ||
          doc.title.toLowerCase().includes(query) ||
          doc.slug.toLowerCase().includes(query),
      )
      .slice()
      .sort((a, b) => compareDocuments(a, b, sortKey, sortDirection));
  }, [documents, search, statusFilter, sortKey, sortDirection]);

  function handleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  if (documents.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No documents yet</EmptyTitle>
          <EmptyDescription>Create the first page for version &quot;{version}&quot;.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title or slug"
          aria-label="Search documents by title or slug"
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger aria-label="Filter by status" size="sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No matching documents</EmptyTitle>
            <EmptyDescription>Try a different search term or status filter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableCaption className="sr-only">
            Documentation pages for version &quot;{version}&quot;: {filtered.length} of {documents.length}{" "}
            shown, sortable by title, category, or last updated.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortableHeader label="Title" sortKey="title" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>
                <SortableHeader label="Category / order" sortKey="category" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <SortableHeader label="Updated" sortKey="updated" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((doc) => (
              <TableRow key={doc.slug}>
                <TableCell className="font-medium">{doc.title}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{doc.slug}</TableCell>
                <TableCell>
                  {doc.category} · {doc.order}
                </TableCell>
                <TableCell>
                  <PublishBadge draft={doc.draft} deprecated={doc.deprecated} />
                </TableCell>
                <TableCell>{doc.updatedAt ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <DocumentActions version={version} slug={doc.slug} draft={doc.draft} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
