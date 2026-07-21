'use client';

import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { PreferencesGrid } from '@/components/dashboard/PreferencesGrid';

export default function AdminNotificationSettingsPage() {
  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · settings"
        title="Notification preferences."
        description="Operations admins always receive SLA + safeguarding + dunning escalations."
      />
      <PreferencesGrid />
    </AdminShell>
  );
}
