'use client';

import { Select } from '../SectionFrame';

export function SelectChips({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const remaining = options.filter((o) => !value.includes(o.value));
  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  return (
    <div className="space-y-2">
      <Select
        value=""
        onChange={(e) => {
          const picked = e.target.value;
          if (picked && !value.includes(picked)) onChange([...value, picked]);
        }}
        options={remaining}
        disabled={remaining.length === 0}
      />
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink/8 text-ink-600 px-2.5 py-1 text-xs"
            >
              {labelFor(v)}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="text-muted hover:text-ink"
                aria-label={`Remove ${labelFor(v)}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
