'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { adminApi } from '@/lib/admin-api';
import { employerTypesApi } from '@/lib/employer-types-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function AdminEmployersRoster() {
  const hydrated = useHydratedTokens();
  const [employerTypeId, setEmployerTypeId] = useState<string>('');
  const [hasSub, setHasSub] = useState<'' | 'true' | 'false'>('');
  const [onboarded, setOnboarded] = useState<'' | 'true' | 'false'>('');

  const types = useQuery({
    queryKey: ['adminEmployerTypes'],
    queryFn: employerTypesApi.adminList,
    enabled: hydrated,
  });

  const list = useQuery({
    queryKey: ['adminEmployersRoster', employerTypeId, hasSub, onboarded],
    queryFn: () =>
      adminApi.rosters.employers({
        employerTypeId: employerTypeId || undefined,
        hasSubscription: hasSub === '' ? undefined : hasSub === 'true',
        onboarded: onboarded === '' ? undefined : onboarded === 'true',
      }),
    enabled: hydrated,
  });

  const pager = usePagination(list.data?.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · employers"
        title="Employers roster"
        description="Both pipelines side by side. Watch corporate rows missing NDPA consent. They cannot legally see worker data until that flips."
      />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div className="flex items-end gap-3">
            <div>
              <p className="text-eyebrow text-muted">Employer type</p>
              <Select
                value={employerTypeId}
                onChange={(e) => setEmployerTypeId(e.target.value)}
                className="mt-1 w-auto"
              >
                <option value="">Any</option>
                {(types.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <p className="text-eyebrow text-muted">Subscription</p>
              <Select
                value={hasSub}
                onChange={(e) => setHasSub(e.target.value as '' | 'true' | 'false')}
                className="mt-1 w-auto"
              >
                <option value="">Any</option>
                <option value="true">Active</option>
                <option value="false">None</option>
              </Select>
            </div>
            <div>
              <p className="text-eyebrow text-muted">Onboarded</p>
              <Select
                value={onboarded}
                onChange={(e) => setOnboarded(e.target.value as '' | 'true' | 'false')}
                className="mt-1 w-auto"
              >
                <option value="">Any</option>
                <option value="true">Complete</option>
                <option value="false">Pending</option>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted">{list.data?.meta.total ?? 0} total</p>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Organisation</TH>
              <TH>Contact</TH>
              <TH>Pipeline</TH>
              <TH>Subscription</TH>
              <TH>Onboarded</TH>
              <TH>NDPA</TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map((e) => {
              const ndpaMissing = e.employerType === 'CORPORATE' && !e.ndpaConsentGiven;
              return (
                <TR key={e.id}>
                  <TD>{e.orgName ?? e.fullName}</TD>
                  <TD muted>{e.email}</TD>
                  <TD>{e.employerType}</TD>
                  <TD>
                    <Badge tone={e.activeSubscriptionId ? 'sage' : 'neutral'}>
                      {e.activeSubscriptionId ? 'Active' : '—'}
                    </Badge>
                  </TD>
                  <TD muted>
                    {e.onboardingCompletedAt
                      ? new Date(e.onboardingCompletedAt).toLocaleDateString()
                      : 'Pending'}
                  </TD>
                  <TD>
                    {e.employerType === 'CORPORATE' ? (
                      <Badge tone={ndpaMissing ? 'terracotta' : 'sage'}>
                        {ndpaMissing ? 'Missing' : 'Consented'}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted">n/a</span>
                    )}
                  </TD>
                </TR>
              );
            })}
            {(list.data?.data ?? []).length === 0 ? (
              <TableEmpty colSpan={6}>No employers match these filters.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
        <Pagination state={pager} />
      </Card>
    </AdminShell>
  );
}
