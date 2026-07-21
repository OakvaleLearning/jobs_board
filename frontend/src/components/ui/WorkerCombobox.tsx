'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { adminApi, type WorkerRosterRow } from '@/lib/admin-api';

function workerLabel(w: Pick<WorkerRosterRow, 'id' | 'fullName'>): string {
  return w.fullName ?? w.id.slice(0, 8);
}

/**
 * Searchable worker picker. Controlled by a worker `id` (UUID) so it can be dropped into
 * react-hook-form via `Controller`. Queries the admin workers roster as the user types.
 */
export function WorkerCombobox({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (workerId: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce the search term fed to the query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const q = useQuery({
    queryKey: ['workerPicker', debounced],
    queryFn: () => adminApi.rosters.workers({ q: debounced || undefined, page: 1 }),
    enabled: open,
  });

  const rows = q.data?.data ?? [];

  // Resolve the label for the currently-selected id. It may not be in the current
  // result set, so remember the last row we selected.
  const [selectedLabel, setSelectedLabel] = useState('');
  const displayLabel = useMemo(() => {
    if (!value) return '';
    const inRows = rows.find((r) => r.id === value);
    if (inRows) return workerLabel(inRows);
    return selectedLabel;
  }, [value, rows, selectedLabel]);

  function select(row: WorkerRosterRow) {
    onChange(row.id);
    setSelectedLabel(workerLabel(row));
    setOpen(false);
    setQuery('');
  }

  function clear() {
    onChange('');
    setSelectedLabel('');
    setQuery('');
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Closed control */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-invalid={error ? 'true' : undefined}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-ink/12 bg-white px-4 h-11 text-left text-ink shadow-edge',
          'focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
          'transition',
          error && 'border-terracotta-500/60 focus:border-terracotta-500',
        )}
      >
        <span className={cn('truncate', !displayLabel && 'text-muted-soft')}>
          {displayLabel || 'Choose a worker…'}
        </span>
        <span className="flex items-center gap-1">
          {value ? (
            <X
              className="h-4 w-4 text-muted hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
            />
          ) : null}
          <ChevronDown className="h-4 w-4 text-brand-500" />
        </span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-ink/12 bg-white shadow-card">
          <div className="relative border-b border-ink/8 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
              className="w-full rounded-lg border border-ink/12 bg-white pl-9 pr-3 h-10 text-ink placeholder:text-muted-soft focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {q.isLoading ? (
              <li className="px-4 py-3 text-sm text-muted">Loading…</li>
            ) : rows.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted">No workers found.</li>
            ) : (
              rows.map((row) => {
                const secondary = [row.phone, row.stateOfOrigin].filter(Boolean).join(' · ');
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => select(row)}
                      className={cn(
                        'flex w-full flex-col items-start px-4 py-2 text-left hover:bg-cream-200/60',
                        row.id === value && 'bg-cream-200/40',
                      )}
                    >
                      <span className="text-sm text-ink">{workerLabel(row)}</span>
                      {secondary ? (
                        <span className="text-xs text-muted">{secondary}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
