'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Role } from '@oakvale/shared/roles';
import { setTokens, logout as apiLogout } from './api-client';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

interface AuthState {
  user: AuthUser | null;
  setSession: (input: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setSession: ({ user, accessToken, refreshToken }) => {
        setTokens({ accessToken, refreshToken });
        if (typeof document !== 'undefined') {
          document.cookie = `oak_role=${user.role}; path=/; max-age=604800; samesite=lax`;
        }
        set({ user });
      },
      clear: () => {
        setTokens(null);
        if (typeof document !== 'undefined') {
          document.cookie = 'oak_role=; path=/; max-age=0';
        }
        set({ user: null });
      },
    }),
    {
      name: 'oak_user',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user }),
    },
  ),
);

/** Convenience selector — true only for the ADMIN role (AGENT is not an admin). */
export function useIsAdmin(): boolean {
  return useAuth((s) => s.user?.role === 'ADMIN');
}

/**
 * Centralised sign-out: best-effort server revoke → clear local session →
 * always land on the auth page. Use everywhere instead of calling `clear()`.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  const clear = useAuth((s) => s.clear);
  return useCallback(async () => {
    await apiLogout().catch(() => {});
    clear();
    router.push('/login');
  }, [clear, router]);
}
