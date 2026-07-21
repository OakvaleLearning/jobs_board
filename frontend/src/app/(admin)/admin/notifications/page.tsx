'use client';

import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { InboxView } from '@/components/dashboard/InboxView';

export default function AdminInboxPage() {
  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · inbox"
        title="Operations inbox."
        description="SLA warnings, safeguarding flags, and dunning escalations land here."
      />
      <InboxView />
    </AdminShell>
  );
}
