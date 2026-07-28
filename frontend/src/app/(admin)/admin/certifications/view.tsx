'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { adminApi, type CertSubmissionRow } from '@/lib/admin-api';
import { toast, toastApiError } from '@/lib/toast';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { CertReviewModal, statusTone } from './CertReviewModal';

export function CertificationsView() {
  const hydrated = useHydratedTokens();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [oakvaleOnly, setOakvaleOnly] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [reviewing, setReviewing] = useState<CertSubmissionRow | null>(null);

  const query = useQuery({
    queryKey: ['adminCertifications', { search, oakvaleOnly }],
    queryFn: () => adminApi.certifications({ q: search || undefined, oakvaleOnly, limit: 200 }),
    enabled: hydrated,
  });

  const rows = query.data?.data ?? [];
  const pager = usePagination(rows);

  async function onExport() {
    setDownloading(true);
    try {
      await adminApi.exportCertificationsCsv({ q: search || undefined, oakvaleOnly });
      toast.success('Export downloaded.');
    } catch (e) {
      toastApiError(e, 'Could not export certifications.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · compliance"
        title="Certificate cross-check."
        description="Every certificate submission with the worker's contact details, so you can reconcile against Oakvale's certified-student list in bulk, then export to CSV."
        actions={
          <Button onClick={onExport} disabled={downloading || rows.length === 0}>
            <Download className="h-4 w-4" />
            {downloading ? 'Preparing…' : 'Export CSV'}
          </Button>
        }
      />

      <form
        className="flex flex-wrap items-center gap-3 mb-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, or issuer"
          className="max-w-xs"
        />
        <Button size="sm" type="submit">
          Search
        </Button>
        <label className="flex items-center gap-2 text-sm text-ink-600 ml-1">
          <Switch checked={oakvaleOnly} onChange={setOakvaleOnly} aria-label="Oakvale certificates only" />
          Oakvale certificates only
        </label>
      </form>

      <Table>
        <THead>
          <TR>
            <TH>Worker</TH>
            <TH>Contact</TH>
            <TH>Certificate</TH>
            <TH>Number</TH>
            <TH>Issued</TH>
            <TH>Status</TH>
            <TH>Review</TH>
          </TR>
        </THead>
        <TBody>
          {pager.pageRows.map((c) => (
            <TR key={c.certificationId} className="align-top">
              <TD>
                <p className="font-medium">{c.fullName ?? c.workerId.slice(0, 8)}</p>
                <p className="text-xs text-muted">
                  Submitted {new Date(c.submittedAt).toLocaleDateString()}
                </p>
              </TD>
              <TD className="text-ink-600">
                <p>{c.email}</p>
                {c.phone ? <p className="text-xs text-muted">{c.phone}</p> : null}
              </TD>
              <TD>
                <Badge tone={c.isOakvaleCert ? 'brand' : 'neutral'}>
                  {c.certType.replace(/_/g, ' ').toLowerCase()}
                </Badge>
                <p className="text-xs text-muted mt-1">{c.issuedBy}</p>
              </TD>
              <TD className="text-ink-600">
                {c.certNumber ?? <span className="text-muted">—</span>}
              </TD>
              <TD className="text-ink-600">{c.issuedAt}</TD>
              <TD>
                <Badge tone={statusTone(c.verificationStatus)}>
                  {c.verificationStatus.toLowerCase()}
                </Badge>
              </TD>
              <TD>
                <Button size="sm" variant="ghost" onClick={() => setReviewing(c)}>
                  Review
                </Button>
              </TD>
            </TR>
          ))}
          {rows.length === 0 && !query.isLoading ? (
            <TableEmpty colSpan={6}>No certificate submissions match.</TableEmpty>
          ) : null}
        </TBody>
      </Table>
      <Pagination state={pager} className="mt-4" />

      <CertReviewModal cert={reviewing} onClose={() => setReviewing(null)} />
    </AdminShell>
  );
}
