'use client';

import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { AccountSettings } from '@/components/account/AccountSettings';
import { WORKER_NAV } from '@/lib/worker-nav';

export default function WorkerAccountPage() {
  return (
    <DashboardShell surface="Worker · account" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Account"
        title="Account & security."
        description="Update your login details and password. Your caregiver profile lives under “My profile”."
      />
      <AccountSettings />
    </DashboardShell>
  );
}
