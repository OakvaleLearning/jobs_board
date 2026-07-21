'use client';

import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

/** Most-recent toasts; older ones drop off the top of the stack. */
const MAX_TOASTS = 4;

interface ToastState {
  toasts: Toast[];
  add: (toast: Toast) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) =>
    set((s) => ({ toasts: [...s.toasts, toast].slice(-MAX_TOASTS) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
