'use client';

import { forwardRef, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { guessFieldIcon } from '@/lib/field-icons';

export function SectionFrame({
  letter,
  title,
  description,
  status,
  onSave,
  children,
  actions,
}: {
  letter: string;
  title: string;
  description?: string;
  status?: 'saved' | 'saving' | 'dirty' | 'idle';
  onSave?: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink/8 bg-white shadow-card overflow-hidden">
      <header className="flex items-start justify-between gap-6 p-6 md:p-8 border-b border-ink/8">
        <div className="flex items-start gap-5">
          <span className="h-display text-3xl text-muted leading-none mt-1">{letter}</span>
          <div>
            <h2 className="h-display text-2xl text-ink leading-tight">{title}</h2>
            {description ? <p className="text-sm text-ink-600 mt-1 max-w-xl">{description}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status === 'saving' ? <Badge tone="neutral">Saving…</Badge> : null}
          {status === 'saved' ? <Badge tone="sage">Saved</Badge> : null}
          {status === 'dirty' ? <Badge tone="terracotta">Unsaved</Badge> : null}
          {actions}
          {onSave ? (
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={status === 'saving'}
            >
              {status === 'saving' ? 'Saving…' : 'Save'}
            </Button>
          ) : null}
        </div>
      </header>
      <div className="p-6 md:p-8">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  className?: string;
  /** Schema-driven marker: true → required asterisk, false → "(optional)", undefined → no marker. */
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className={cn(
          'text-label',
          error ? 'text-terracotta-700' : 'text-muted',
        )}
      >
        {label}
        {required === true ? (
          <span aria-hidden className="ml-0.5 text-terracotta-600">*</span>
        ) : null}
        {required === false ? (
          <span className="ml-1 normal-case text-muted/70">(optional)</span>
        ) : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export const Select = forwardRef<
  HTMLSelectElement,
  {
    options?: { value: string; label: string }[];
    /** Leading icon. Omit to auto-infer from name; pass `null` to opt out. */
    icon?: LucideIcon | null;
  } & React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ options, icon, ...props }, ref) {
  const Icon =
    icon === null ? null : icon ?? guessFieldIcon({ name: props.name, kind: 'select' });
  return (
    <div className="relative">
      {Icon ? (
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-500" />
      ) : null}
      <select
        ref={ref}
        {...props}
        className={cn(
          'w-full rounded-xl border border-ink/12 bg-white px-4 h-11 text-ink shadow-edge focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition',
          Icon && 'pl-10',
        )}
      >
        <option value="" disabled>
          Choose…
        </option>
        {(options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea(props, ref) {
    return (
      <textarea
        ref={ref}
        {...props}
        className="w-full rounded-xl border border-ink/12 bg-white px-4 py-3 text-ink shadow-edge focus:outline-none focus:border-ink/40 transition min-h-[120px]"
      />
    );
  },
);
