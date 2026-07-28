'use client';

import { AlertCircle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore, type ToastTone } from '@/lib/toast-store';

const toneCard: Record<ToastTone, string> = {
  success: 'bg-sage-50 border border-sage-200 text-sage-600',
  error: 'bg-terracotta-50 border border-terracotta-200 text-terracotta-700',
  info: 'bg-brand-50 border border-brand-200 text-brand-700',
};

const toneIcon: Record<ToastTone, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 bg-white text-slate-500"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = toneIcon[t.tone];
        return (
        <div
          key={t.id}
          className={cn(
            'animate-rise rounded-2xl px-4 py-3 shadow-lg',
            'flex items-start gap-3',
            toneCard[t.tone],
          )}
        >
          <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">{t.title}</p>
            {t.description ? (
              <p className="mt-0.5 text-xs text-ink-600">{t.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="-mr-1 -mt-0.5 shrink-0 rounded-lg px-1.5 text-lg leading-none opacity-50 transition hover:opacity-100"
          >
            ×
          </button>
        </div>
        );
      })}
    </div>
  );
}
