'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { WorkerCombobox } from '@/components/ui/WorkerCombobox';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { Field, Select, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { complianceApi } from '@/lib/compliance-api';
import { toast, toastApiError, toastFormErrors } from '@/lib/toast';
import { flagCreateSchema, type FlagCreateInput } from '@oakvale/shared/schema/verification';
import { FLAG_SEVERITIES, FLAG_TYPES } from '@oakvale/shared/enums/verification';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function FlagsView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [showForm, setShowForm] = useState(false);

  const q = useQuery({
    queryKey: ['adminFlags', { onlyActive: true }],
    queryFn: () => complianceApi.flags({ onlyActive: true }),
    enabled: hydrated,
  });

  const pager = usePagination(q.data ?? []);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FlagCreateInput>({
    resolver: zodResolver(flagCreateSchema),
    defaultValues: { flagType: 'SAFEGUARDING', severity: 'HIGH' },
  });

  const raise = useMutation({
    mutationFn: complianceApi.raiseFlag,
    onSuccess: () => {
      toast.success('Flag raised.');
      queryClient.invalidateQueries({ queryKey: ['adminFlags'] });
      reset({ flagType: 'SAFEGUARDING', severity: 'HIGH', workerId: '', details: '' });
      setShowForm(false);
    },
    onError: (e) => toastApiError(e, 'Could not raise the flag.'),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => complianceApi.resolveFlag(id),
    onSuccess: () => {
      toast.success('Flag resolved.');
      queryClient.invalidateQueries({ queryKey: ['adminFlags'] });
    },
    onError: (e) => toastApiError(e, 'Could not resolve the flag.'),
  });

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · compliance flags"
        title="Raise. Resolve. Audit."
        description="A SAFEGUARDING flag on a placed worker will auto-suspend their placements."
        actions={<Button onClick={() => setShowForm(true)}>Raise flag</Button>}
      />

      <Table>
        <THead>
          <TR>
            <TH>Worker</TH>
            <TH>Type</TH>
            <TH>Severity</TH>
            <TH>Details</TH>
            <TH className="text-right">Action</TH>
          </TR>
        </THead>
        <TBody>
          {pager.pageRows.map((f) => (
            <TR key={f.id} className="align-top">
              <TD>
                <p>{f.fullName ?? f.workerId.slice(0, 8)}</p>
                <p className="text-xs text-muted">
                  Raised {new Date(f.raisedAt).toLocaleString()}
                </p>
              </TD>
              <TD>
                <Badge tone={f.flagType === 'SAFEGUARDING' ? 'terracotta' : 'neutral'}>{f.flagType}</Badge>
              </TD>
              <TD>
                <Badge tone={f.severity === 'CRITICAL' || f.severity === 'HIGH' ? 'terracotta' : 'neutral'}>
                  {f.severity}
                </Badge>
              </TD>
              <TD className="max-w-md text-ink-600">{f.details}</TD>
              <TD>
                <div className="flex items-center justify-end gap-1">
                  <IconButton icon={Check} label="Resolve" tone="primary" onClick={() => resolve.mutate(f.id)} />
                </div>
              </TD>
            </TR>
          ))}
          {(q.data ?? []).length === 0 ? (
            <TableEmpty colSpan={5}>No active flags.</TableEmpty>
          ) : null}
        </TBody>
      </Table>
      <Pagination state={pager} className="mt-4" />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New flag"
        description="Raise a compliance flag"
      >
        <form onSubmit={handleSubmit((v) => raise.mutate(v), toastFormErrors)} className="space-y-3">
          <Field label="Worker" error={errors.workerId?.message}>
            <Controller
              name="workerId"
              control={control}
              render={({ field }) => (
                <WorkerCombobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={errors.workerId?.message}
                />
              )}
            />
          </Field>
          <Field label="Type">
            <Select
              {...register('flagType')}
              options={FLAG_TYPES.map((t) => ({ value: t, label: t.toLowerCase() }))}
            />
          </Field>
          <Field label="Severity">
            <Select
              {...register('severity')}
              options={FLAG_SEVERITIES.map((s) => ({ value: s, label: s.toLowerCase() }))}
            />
          </Field>
          <Field label="Details" error={errors.details?.message}>
            <Textarea {...register('details')} />
          </Field>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={raise.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={raise.isPending}>
              {raise.isPending ? 'Raising…' : 'Raise flag'}
            </Button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
}
