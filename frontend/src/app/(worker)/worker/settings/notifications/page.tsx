'use client';

import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { PreferencesGrid } from '@/components/dashboard/PreferencesGrid';
import { WORKER_NAV } from '@/lib/worker-nav';

export default function WorkerNotificationSettingsPage() {
  return (
    <DashboardShell surface="Worker · settings" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Settings"
        title="Notification preferences."
        description="Pick which updates reach you and where they land."
      />
      <PreferencesGrid />
    </DashboardShell>
  );
}
