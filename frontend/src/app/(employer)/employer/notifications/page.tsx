'use client';

import { useQuery } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { InboxView } from '@/components/dashboard/InboxView';
import { employersApi } from '@/lib/employers-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export default function EmployerInboxPage() {
  const hydrated = useHydratedTokens();
  const me = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });
  return (
    <EmployerShell config={me.data?.employerTypeConfig}>
      <PageHeader
        eyebrow="Inbox"
        title="Your notifications."
        description="Placement updates, invoice reminders, subscription events."
      />
      <InboxView />
    </EmployerShell>
  );
}
