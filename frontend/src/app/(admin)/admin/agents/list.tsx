'use client';

import { Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { Field, Select as FormSelect } from '@/app/(worker)/worker/profile/SectionFrame';
import { toast, toastApiError } from '@/lib/toast';
import { adminApi } from '@/lib/admin-api';
import {
  AGENT_SPECIALTY_OPTIONS,
  AGENT_SPECIALTY_LABELS,
  type AgentSpecialty,
} from '@oakvale/shared/enums/admin';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function AdminAgents() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [filter, setFilter] = useState<AgentSpecialty | ''>('');
  const [showForm, setShowForm] = useState(false);

  const list = useQuery({
    queryKey: ['adminAgents', filter],
    queryFn: () => adminApi.agents.list({ specialty: (filter || undefined) as AgentSpecialty | undefined }),
    enabled: hydrated,
  });

  const pager = usePagination(list.data?.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · agents"
        title="Oakvale agents"
        description="BDMs, Recruiters, Liaison Nurses, Account Managers, and Admins who run placements end-to-end."
        actions={
          <Button size="sm" onClick={() => setShowForm(true)}>
            Add agent
          </Button>
        }
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Create an Oakvale agent"
        description="New agent"
        size="lg"
      >
        <AddAgentForm
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['adminAgents'] });
          }}
        />
      </Modal>

      <Card className="mt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardEyebrow>Roster</CardEyebrow>
            <CardTitle>{list.data?.data.length ?? 0} agents</CardTitle>
          </div>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as AgentSpecialty | '')}
            className="w-auto"
          >
            <option value="">All specialties</option>
            {AGENT_SPECIALTY_OPTIONS.map((s) => (
              <option key={s} value={s}>{AGENT_SPECIALTY_LABELS[s]}</option>
            ))}
          </Select>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Specialty</TH>
              <TH>Region</TH>
              <TH>Status</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map(({ user, profile }) => (
              <TR key={user.id} onClick={() => router.push(`/admin/agents/${user.id}`)}>
                <TD>{user.fullName}</TD>
                <TD muted>{user.email}</TD>
                <TD>{AGENT_SPECIALTY_LABELS[profile.specialty]}</TD>
                <TD muted>{profile.region ?? '—'}</TD>
                <TD>
                  <Badge tone={user.isActive ? 'sage' : 'neutral'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton
                      icon={Settings}
                      label="Manage"
                      href={`/admin/agents/${user.id}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </TD>
              </TR>
            ))}
            {(list.data?.data ?? []).length === 0 ? (
              <TableEmpty colSpan={6}>No agents yet.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
        <Pagination state={pager} />
      </Card>
    </AdminShell>
  );
}

function AddAgentForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    phone: '',
    password: '',
    specialty: 'RECRUITER' as AgentSpecialty,
    region: '',
    bio: '',
  });

  const create = useMutation({
    mutationFn: () =>
      adminApi.agents.create({
        email: form.email,
        fullName: form.fullName,
        phone: form.phone || undefined,
        password: form.password,
        specialty: form.specialty,
        region: form.region || undefined,
        bio: form.bio || undefined,
      }),
    onSuccess: () => {
      toast.success('Agent created.');
      onCreated();
    },
    onError: (e) => toastApiError(e, 'Could not create agent.'),
  });

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Full name">
          <Input name="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Phone (optional)">
          <Input name="phone" type='tel' value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Temporary password">
          <Input
            name="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="Specialty">
          <FormSelect
            name="specialty"
            value={form.specialty}
            onChange={(e) => setForm({ ...form, specialty: e.target.value as AgentSpecialty })}
            options={AGENT_SPECIALTY_OPTIONS.map((s) => ({
              value: s,
              label: AGENT_SPECIALTY_LABELS[s],
            }))}
          />
        </Field>
        <Field label="Region (optional)">
          <Input name="region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          size="sm"
          onClick={() => create.mutate()}
          disabled={
            create.isPending ||
            form.email.length < 5 ||
            form.fullName.length < 2 ||
            form.password.length < 8
          }
        >
          {create.isPending ? 'Creating…' : 'Create agent'}
        </Button>
      </div>
    </>
  );
}
