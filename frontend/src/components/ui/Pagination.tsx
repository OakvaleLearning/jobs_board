'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface PaginationState<T> {
  /** Rows for the current page only. */
  pageRows: T[];
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  /** Total rows across all pages. */
  total: number;
  /** 1-based index of the first row shown (0 when empty). */
  pageStart: number;
  /** 1-based index of the last row shown. */
  pageEnd: number;
  pageSize: number;
}

/**
 * Client-side pagination over an already-fetched array. Slices `rows` into
 * pages of `pageSize` and tracks the current page, clamping if the underlying
 * data shrinks (e.g. after a filter change). Pair with <Pagination /> below the table.
 */
export function usePagination<T>(rows: T[], pageSize = 10): PaginationState<T> {
  const [page, setPage] = useState(1);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return {
    pageRows,
    page: current,
    setPage,
    totalPages,
    total,
    pageStart: total === 0 ? 0 : start + 1,
    pageEnd: Math.min(start + pageSize, total),
    pageSize,
  };
}

/** Prev/next pager with a "showing X–Y of N" summary. Renders nothing for a single page. */
export function Pagination<T>({
  state,
  className,
}: {
  state: PaginationState<T>;
  className?: string;
}) {
  const { page, setPage, totalPages, total, pageStart, pageEnd } = state;
  if (totalPages <= 1) return null;

  return (
    <div className={cn('mt-4 flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-xs text-muted tabular-nums">
        Showing {pageStart}–{pageEnd} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Prev
        </Button>
        <span className="text-xs text-muted tabular-nums px-1">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
