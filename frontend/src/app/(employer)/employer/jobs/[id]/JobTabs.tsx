'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { segment: '', label: 'Edit' },
  { segment: '/applicants', label: 'Applicants' },
  { segment: '/shortlist', label: 'Shortlist' },
] as const;

export function JobTabs({ jobId }: { jobId: string }) {
  const pathname = usePathname();
  const base = `/employer/jobs/${jobId}`;

  return (
    <nav className="mb-6 flex gap-6 border-b border-ink/8">
      {TABS.map((tab) => {
        const href = `${base}${tab.segment}`;
        const active = pathname === href;
        return (
          <Link
            key={tab.label}
            href={href}
            className={
              'pb-3 text-sm -mb-px border-b-2 ' +
              (active
                ? 'border-ink text-ink font-medium'
                : 'border-transparent text-muted hover:text-ink')
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
