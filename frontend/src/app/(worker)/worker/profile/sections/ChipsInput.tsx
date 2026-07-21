'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

export function ChipsInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setDraft('');
  }
  return (
    <div className="rounded-xl border border-ink/12 bg-white px-3 py-2 shadow-edge flex flex-wrap items-center gap-2 min-h-11">
      {value.map((v) => (
        <span
          key={v}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full bg-ink/8 text-ink-600 px-2.5 py-1 text-xs',
          )}
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="text-muted hover:text-ink"
            aria-label={`Remove ${v}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[8ch] bg-transparent text-sm focus:outline-none py-1"
      />
    </div>
  );
}
