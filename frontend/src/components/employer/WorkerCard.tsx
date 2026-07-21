import Link from 'next/link';
import { Check, MapPin, Star } from 'lucide-react';
import { Card, CardEyebrow } from '@/components/ui/Card';
import type { BrowseWorkerRow } from '@/lib/employers-api';

export function WorkerCard({ row, categoryName }: { row: BrowseWorkerRow; categoryName?: string }) {
  const pct = Math.max(0, Math.min(100, row.profileCompletionPct ?? 0));

  return (
    <Link href={`/employer/workers/${row.id}`} className="block group">
      <Card
        variant="glass"
        className="h-full flex flex-col cursor-pointer transition duration-300 group-hover:shadow-card group-hover:-translate-y-0.5 group-hover:border-brand-500/30"
      >
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- static placeholder; no PII shown on browse */}
          <img
            src="/profile-placeholder.svg"
            alt="Profile placeholder"
            className="h-16 w-16 shrink-0 rounded-2xl border border-ink/8 object-cover ring-1 ring-ink/5"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <CardEyebrow>{categoryName ?? 'Verified worker'}</CardEyebrow>
            <div className="mt-1 flex items-center gap-1.5">
              <p className="h-display text-xl truncate">{row.fullName ?? 'Unnamed worker'}</p>
              <span className="shrink-0" title="Verified worker">
                <Star className="h-4 w-4 fill-brand-500 text-brand-500" aria-hidden />
                <span className="sr-only">Verified worker</span>
              </span>
            </div>
            {row.stateOfOrigin ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{row.stateOfOrigin}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-600">
          <Credential label="Identity" />
          <Credential label="Background" />
          <Credential label="Oakvale CPD" />
        </div>

        <div className="mt-auto pt-6">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted tabular-nums">{pct}% complete</span>
            <span className="font-medium text-ink/60 transition group-hover:text-ink">
              View profile →
            </span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink/8">
            <div
              className="h-full rounded-full bg-sage-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Credential({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Check className="h-3.5 w-3.5 shrink-0 text-sage-500" aria-hidden />
      {label}
    </span>
  );
}
