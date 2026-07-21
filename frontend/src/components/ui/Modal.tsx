'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className="fixed inset-0 bg-ink/40 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 my-auto w-full rounded-3xl border border-ink/8 bg-white shadow-card',
          'max-h-[90vh] flex flex-col outline-none animate-fade-up',
          SIZE_CLASSES[size],
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-20 rounded-full p-1.5 text-ink-600 transition hover:bg-ink/5 hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="relative z-10 px-6 py-6 text-center shadow-[0_10px_16px_-12px_rgba(28,26,23,0.25)]">
          {title ? (
            <h2 id="modal-title" className="h-display text-xl text-primary leading-tight">
              {title}
            </h2>
          ) : null}
          {description ? <p className="text-sm text-ink-600 mt-1">{description}</p> : null}
        </div>
        <div className="no-scrollbar overflow-y-auto px-6 pb-6 pt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
