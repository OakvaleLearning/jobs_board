'use client';

import { useQuery } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { PreferencesGrid } from '@/components/dashboard/PreferencesGrid';
import { employersApi } from '@/lib/employers-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export default function EmployerNotificationSettingsPage() {
  const hydrated = useHydratedTokens();
  const me = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });
  return (
    <EmployerShell config={me.data?.employerTypeConfig}>
      <PageHeader
        eyebrow="Settings"
        title="Notification preferences."
        description="Pick which updates reach you and where they land. Safeguarding and SLA alerts are always on."
      />
      <PreferencesGrid />
    </EmployerShell>
  );
}
