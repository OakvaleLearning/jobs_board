'use client';

import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { InboxView } from '@/components/dashboard/InboxView';
import { WORKER_NAV } from '@/lib/worker-nav';

export default function WorkerInboxPage() {
  return (
    <DashboardShell surface="Worker · inbox" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Inbox"
        title="Your notifications."
        description="Welfare reminders, CPD expiry warnings, placement updates."
      />
      <InboxView />
    </DashboardShell>
  );
}
