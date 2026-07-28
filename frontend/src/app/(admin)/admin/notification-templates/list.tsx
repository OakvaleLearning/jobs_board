'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { toast, toastApiError } from '@/lib/toast';
import {
  adminApi,
  type NotificationTemplateBody,
  type NotificationTemplateDetail,
  type NotificationTemplateRow,
} from '@/lib/admin-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function NotificationTemplatesView() {
  const hydrated = useHydratedTokens();
  const [selected, setSelected] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['notificationTemplates'],
    queryFn: () => adminApi.notificationTemplates.list(),
    enabled: hydrated,
  });

  const rows = list.data ?? [];

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · notifications"
        title="Notification templates"
        description="Edit the copy for each notification. Use {{variable}} placeholders. They’re filled in at send time. Changes apply to the next notification sent."
        actions={<Badge tone="neutral">{rows.length} templates</Badge>}
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <Card className="!p-0 overflow-hidden h-fit">
          <ul className="divide-y divide-ink/8">
            {rows.map((t) => (
              <li key={t.kind}>
                <button
                  type="button"
                  onClick={() => setSelected(t.kind)}
                  className={`w-full text-left px-4 py-3 hover:bg-cream-200/50 transition ${
                    selected === t.kind ? 'bg-cream-200/70' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-ink">{t.label}</span>
                    {t.isModified ? (
                      <Badge tone="brand" className="text-[10px]">Edited</Badge>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-muted">{t.kind}</span>
                </button>
              </li>
            ))}
            {rows.length === 0 ? <li className="px-4 py-6 text-sm text-muted">Loading…</li> : null}
          </ul>
        </Card>

        {selected ? (
          <TemplateEditor key={selected} kind={selected} />
        ) : (
          <Card className="text-sm text-muted h-fit">Select a notification on the left to edit its copy.</Card>
        )}
      </div>
    </AdminShell>
  );
}

function TemplateEditor({ kind }: { kind: string }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ['notificationTemplate', kind],
    queryFn: () => adminApi.notificationTemplates.get(kind),
    enabled: true,
  });

  if (detail.isLoading || !detail.data) {
    return <Card className="text-sm text-muted h-fit">Loading template…</Card>;
  }
  return <EditorForm detail={detail.data} onSaved={() => {
    queryClient.invalidateQueries({ queryKey: ['notificationTemplates'] });
    queryClient.invalidateQueries({ queryKey: ['notificationTemplate', kind] });
  }} />;
}

function EditorForm({ detail, onSaved }: { detail: NotificationTemplateDetail; onSaved: () => void }) {
  const [body, setBody] = useState<NotificationTemplateBody>({
    subject: detail.template.subject,
    text: detail.template.text,
    html: detail.template.html,
    sms: detail.template.sms,
  });
  const [preview, setPreview] = useState<NotificationTemplateBody | null>(null);

  const previewMut = useMutation({
    mutationFn: () => adminApi.notificationTemplates.preview(detail.kind, body),
    onSuccess: (d) => setPreview(d),
    onError: (e) => toastApiError(e, 'Could not render preview.'),
  });

  const saveMut = useMutation({
    mutationFn: () => adminApi.notificationTemplates.update(detail.kind, body),
    onSuccess: () => {
      toast.success('Template saved. New notifications will use it.');
      onSaved();
    },
    onError: (e) => toastApiError(e, 'Could not save template.'),
  });

  // Render an initial preview whenever the editor mounts for a kind.
  useEffect(() => {
    previewMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = !body.subject.trim() || !body.text.trim() || !body.html.trim() || !body.sms.trim();
  const set = (k: keyof NotificationTemplateBody) => (e: { target: { value: string } }) =>
    setBody((b) => ({ ...b, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <Card>
        <CardEyebrow>{detail.kind}</CardEyebrow>
        <CardTitle>{detail.label}</CardTitle>

        {detail.variables.length > 0 ? (
          <div className="mt-3">
            <p className="text-eyebrow text-muted mb-1.5">Available variables</p>
            <div className="flex flex-wrap gap-1.5">
              {detail.variables.map((v) => (
                <Badge key={v.name} tone="brand" className="text-[10px]">{`{{${v.name}}}`}</Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted mt-3">This notification has no variables.</p>
        )}

        <div className="mt-5 space-y-4">
          <Field label="Email subject">
            <Input value={body.subject} onChange={set('subject')} />
          </Field>
          <Field label="Email body (plain text)">
            <Textarea rows={4} value={body.text} onChange={set('text')} />
          </Field>
          <Field label="Email body (HTML)">
            <Textarea rows={4} value={body.html} onChange={set('html')} />
          </Field>
          <Field label="SMS">
            <Textarea rows={2} value={body.sms} onChange={set('sms')} />
          </Field>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || empty}>
            {saveMut.isPending ? 'Saving…' : 'Save template'}
          </Button>
          <Button variant="outline" onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
            Refresh preview
          </Button>
          <Button
            variant="outline"
            onClick={() => setBody({ ...detail.default })}
            disabled={saveMut.isPending}
          >
            Reset to default
          </Button>
        </div>
      </Card>

      <Card>
        <CardEyebrow>Live preview</CardEyebrow>
        <CardTitle>With sample values</CardTitle>
        {preview ? (
          <dl className="mt-4 space-y-3 text-sm">
            <Preview label="Subject" value={preview.subject} />
            <Preview label="Email (text)" value={preview.text} />
            <Preview label="SMS" value={preview.sms} />
            <div>
              <dt className="text-eyebrow text-muted">Email (HTML)</dt>
              <dd
                className="mt-1 rounded-xl border border-ink/10 bg-cream-50 p-3 text-ink prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted mt-3">Preview will appear here.</p>
        )}
      </Card>
    </div>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-eyebrow text-muted">{label}</dt>
      <dd className="mt-1 rounded-xl border border-ink/10 bg-cream-50 p-3 text-ink whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
