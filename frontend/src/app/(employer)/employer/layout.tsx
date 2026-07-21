import type { ReactNode } from 'react';
import { OnboardingGuard } from './OnboardingGuard';

export default function EmployerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OnboardingGuard />
      {children}
    </>
  );
}
