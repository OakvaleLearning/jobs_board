'use client';

import { CARE_SPECIALISATION_GROUPS } from '@oakvale/shared/enums/employer';
import { cn } from '@/lib/cn';

/**
 * §5 — grouped, multi-select picker for the care specialisations a job involves.
 * Selections are a flat array of the ticked option labels; grouping is purely
 * presentational. Used on the employer job create + edit forms.
 */
export function SpecialisationPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  }

  return (
    <div className="space-y-4">
      {CARE_SPECIALISATION_GROUPS.map((group) => (
        <div key={group.category} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{group.category}</p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const on = value.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggle(option)}
                  aria-pressed={on}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition',
                    on
                      ? 'border-ink/40 bg-ink text-cream-50'
                      : 'border-ink/12 bg-cream-50 text-muted hover:border-ink/30',
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
