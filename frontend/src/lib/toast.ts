'use client';

import type { FieldErrors } from 'react-hook-form';
import { ApiError } from './api-client';
import { useToastStore, type ToastTone } from './toast-store';

interface ToastOptions {
  description?: string;
  /** Override auto-dismiss in ms. Defaults: 4s for success/info, 6s for errors. */
  duration?: number;
}

function show(tone: ToastTone, title: string, opts?: ToastOptions): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  useToastStore.getState().add({ id, tone, title, description: opts?.description });

  const duration = opts?.duration ?? (tone === 'error' ? 6000 : 4000);
  if (duration > 0 && typeof window !== 'undefined') {
    window.setTimeout(() => useToastStore.getState().dismiss(id), duration);
  }
  return id;
}

export const toast = {
  success: (title: string, opts?: ToastOptions) => show('success', title, opts),
  error: (title: string, opts?: ToastOptions) => show('error', title, opts),
  info: (title: string, opts?: ToastOptions) => show('info', title, opts),
};

/** Toast an error from an API call, falling back to a generic message. */
export function toastApiError(e: unknown, fallback: string): void {
  toast.error(e instanceof ApiError ? e.message : fallback);
}

/**
 * Surface react-hook-form validation failures as toasts. Called as the second
 * (onInvalid) argument to `handleSubmit`. Shows the first few field messages.
 */
export function toastFormErrors(errors: FieldErrors): void {
  const messages = collectMessages(errors).slice(0, 3);
  if (messages.length === 0) {
    toast.error('Please check the form and try again.');
    return;
  }
  for (const message of messages) toast.error(message);
}

function collectMessages(errors: FieldErrors): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.message === 'string' && rec.message) {
      out.push(rec.message);
      return;
    }
    for (const value of Object.values(rec)) walk(value);
  };
  walk(errors);
  return out;
}
