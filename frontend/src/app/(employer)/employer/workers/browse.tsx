'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextLink } from '@/components/ui/Link';
import { WorkerCard } from '@/components/employer/WorkerCard';
import { ApiError } from '@/lib/api-client';
import { employersApi } from '@/lib/employers-api';
import { workforceCategoriesApi } from '@/lib/workforce-categories-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function WorkersBrowse() {
  const hydrated = useHydratedTokens();
  const [q, setQ] = useState('');
  const [workforceCategoryId, setWorkforceCategoryId] = useState('');

  const categories = useQuery({
    queryKey: ['workforceCategories', 'active'],
    queryFn: () => workforceCategoriesApi.list(),
    enabled: hydrated,
  });

  const profile = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });

  const config = profile.data?.employerTypeConfig ?? null;
  const ndpaBlocked = config?.requiresNdpa === true && profile.data?.ndpaConsentGiven === false;

  const list = useQuery({
    queryKey: ['employerWorkerBrowse', { q, workforceCategoryId }],
    queryFn: () =>
      employersApi.browseWorkers({
        q: q || undefined,
        workforceCategoryId: workforceCategoryId || undefined,
      }),
    enabled: hydrated && !ndpaBlocked,
    retry: (count, err) => {
      if (err instanceof ApiError && err.code === 'NDPA_CONSENT_REQUIRED') return false;
      return count < 2;
    },
  });

  return (
    <EmployerShell config={config}>
      <PageHeader
        eyebrow="Worker browse"
        title="Credentialed care, on tap."
        description="Identity-verified, background-checked, Oakvale-certified, and free of active safeguarding flags. No PII shown, credentials only."
        actions={
          <Badge tone="sage">
            {list.data ? `${list.data.meta.total} workers visible` : 'Loading…'}
          </Badge>
        }
      />

      {ndpaBlocked ? (
        <Card className="border-terracotta-500/30">
          <Badge tone="terracotta">NDPA consent required</Badge>
          <p className="text-sm text-ink-600 mt-3 max-w-xl">
            Under the Nigeria Data Protection Act 2023 you must record processing consent before
            viewing worker data. Complete the onboarding wizard to record it.
          </p>
          <TextLink href="/employer/onboarding" className="inline-block mt-4">
            Open onboarding →
          </TextLink>
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-3 max-w-2xl">
            <Input
              placeholder="Search by name or skill…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 min-w-[16rem]"
            />
            <Select
              value={workforceCategoryId}
              onChange={(e) => setWorkforceCategoryId(e.target.value)}
              className="w-auto"
            >
              <option value="">All workforce categories</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {(list.data?.data ?? []).map((w) => (
              <WorkerCard
                key={w.id}
                row={w}
                categoryName={
                  categories.data?.find((c) => c.id === w.workforceCategoryId)?.name
                }
              />
            ))}
            {list.isSuccess && (list.data?.data ?? []).length === 0 ? (
              <Card className="md:col-span-2 xl:col-span-3 text-center text-muted">
                No workers match the current filters.
              </Card>
            ) : null}
          </div>
        </>
      )}
    </EmployerShell>
  );
}
