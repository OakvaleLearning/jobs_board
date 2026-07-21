'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CONTRACT_TYPES, type ContractType } from '@oakvale/shared/enums/contracts';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field, Select, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { toast, toastApiError } from '@/lib/toast';
import { contractsApi } from '@/lib/contracts-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function ContractTemplatesView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [showForm, setShowForm] = useState(false);

  const list = useQuery({
    queryKey: ['contractTemplates'],
    queryFn: () => contractsApi.templates(),
    enabled: hydrated,
  });

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · contract templates"
        title="Template library"
        description="Versioned templates with {{variable}} substitution. Only active templates are used for new contracts."
        actions={<Button onClick={() => setShowForm(true)}>New template</Button>}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Define a contract"
        description="New template"
        size="lg"
      >
        <TemplateForm onCreated={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['contractTemplates'] }); }} />
      </Modal>

      <div className="space-y-3 mt-6">
        {(list.data ?? []).map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardEyebrow>{t.type} · v{t.version}</CardEyebrow>
                <CardTitle>{t.name}</CardTitle>
                {t.notes ? <p className="text-sm text-muted mt-2">{t.notes}</p> : null}
                {t.variables.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.variables.map((v) => (
                      <Badge key={v} tone="brand" className="text-[10px]">{v}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <Badge tone={t.isActive ? 'sage' : 'neutral'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
          </Card>
        ))}
        {(list.data ?? []).length === 0 ? (
          <Card className="text-muted text-sm">No templates yet. Create one to start drafting contracts.</Card>
        ) : null}
      </div>
    </AdminShell>
  );
}

function TemplateForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<ContractType>('WORKER_PLACEMENT');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [notes, setNotes] = useState('');
  const mut = useMutation({
    mutationFn: () => contractsApi.createTemplate({ type, name, body, notes: notes || undefined }),
    onSuccess: () => {
      toast.success('Template saved.');
      onCreated();
    },
    onError: (e) => toastApiError(e, 'Could not save template.'),
  });

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Type">
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as ContractType)}
            options={CONTRACT_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </Field>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Body (Markdown · use {{employer.orgName}} placeholders)">
            <Textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'# Worker Placement Agreement\n\nBetween {{employer.orgName}} and {{worker.fullName}} ...'}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Internal notes (optional)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending || !name || body.length < 40}>
          {mut.isPending ? 'Saving…' : 'Save template'}
        </Button>
      </div>
    </>
  );
}
