import { AppError } from '@/shared/errors/app-error.js';
import * as paymentsService from '@/modules/payments/service.js';
import * as placementsService from '@/modules/placements/service.js';
import * as complianceService from '@/modules/compliance/service.js';
import * as rostersService from './rosters.service.js';
import type { VisibilityStatus } from '@oakvale/shared/enums/worker.js';
import type { PipelineType, PlacementStatus } from '@oakvale/shared/enums/placement.js';

const ROW_CAP = 10_000;

export interface CsvColumn<T> {
  header: string;
  pick: (row: T) => unknown;
}

function csvField(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const out: string[] = [];
  out.push(columns.map((c) => csvField(c.header)).join(','));
  for (const row of rows) {
    out.push(columns.map((c) => csvField(c.pick(row))).join(','));
  }
  return out.join('\r\n');
}

function ensureUnderCap(n: number, resource: string): void {
  if (n > ROW_CAP) {
    throw new AppError({
      code: 'EXPORT_TOO_LARGE',
      message: `${resource} export exceeds ${ROW_CAP} rows. Narrow your filters.`,
      statusCode: 413,
    });
  }
}

export interface InvoiceExportFilters {
  status?: 'OPEN' | 'PAID' | 'VOID' | 'REFUNDED' | 'FAILED';
  pipeline?: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
  provider?: 'STRIPE' | 'PAYSTACK';
  from?: string;
  to?: string;
}

export async function exportInvoicesCsv(filters: InvoiceExportFilters): Promise<string> {
  const rows = await paymentsService.adminListInvoices({ ...filters, page: 1, limit: ROW_CAP + 1 });
  ensureUnderCap(rows.length, 'invoices');
  return toCsv(rows, [
    { header: 'id', pick: (r) => r.id },
    { header: 'employer_id', pick: (r) => r.employerId },
    { header: 'pipeline', pick: (r) => r.pipeline },
    { header: 'purpose', pick: (r) => r.purpose },
    { header: 'status', pick: (r) => r.status },
    { header: 'currency', pick: (r) => r.currency },
    { header: 'amount_minor', pick: (r) => r.amountMinor },
    { header: 'provider', pick: (r) => r.provider },
    { header: 'due_at', pick: (r) => r.dueAt },
    { header: 'paid_at', pick: (r) => r.paidAt },
    { header: 'created_at', pick: (r) => r.createdAt },
  ]);
}

export async function exportPlacementsCsv(filters: {
  status?: PlacementStatus;
  pipeline?: PipelineType;
}): Promise<string> {
  const { rows } = await placementsService.adminList({
    status: filters.status,
    pipeline: filters.pipeline,
    page: 1,
    limit: ROW_CAP + 1,
  });
  ensureUnderCap(rows.length, 'placements');
  return toCsv(rows, [
    { header: 'id', pick: (r) => r.id },
    { header: 'employer_id', pick: (r) => r.employerId },
    { header: 'worker_id', pick: (r) => r.workerId },
    { header: 'pipeline', pick: (r) => r.pipelineType },
    { header: 'status', pick: (r) => r.status },
    { header: 'activated_at', pick: (r) => r.activatedAt },
    { header: 'guarantee_expires_at', pick: (r) => r.guaranteeExpiresAt },
    { header: 'ended_at', pick: (r) => r.endedAt },
    { header: 'created_at', pick: (r) => r.createdAt },
  ]);
}

export async function exportCertificationsCsv(filters: {
  q?: string;
  oakvaleOnly?: boolean;
}): Promise<string> {
  const rows = await complianceService.adminListCertSubmissions({
    ...filters,
    page: 1,
    limit: ROW_CAP + 1,
  });
  ensureUnderCap(rows.length, 'certifications');
  // Columns are ordered for the admin cross-check task (brief §3): identity first
  // so they can reconcile against Oakvale's certified-student list, then cert detail.
  return toCsv(rows, [
    { header: 'full_name', pick: (r) => r.fullName },
    { header: 'email', pick: (r) => r.email },
    { header: 'phone', pick: (r) => r.phone },
    { header: 'cert_type', pick: (r) => r.certType },
    { header: 'cert_number', pick: (r) => r.certNumber },
    { header: 'issued_by', pick: (r) => r.issuedBy },
    { header: 'issued_at', pick: (r) => r.issuedAt },
    { header: 'expires_at', pick: (r) => r.expiresAt },
    { header: 'is_oakvale_cert', pick: (r) => r.isOakvaleCert },
    { header: 'has_document', pick: (r) => r.hasDocument },
    { header: 'submitted_at', pick: (r) => r.submittedAt },
    { header: 'worker_id', pick: (r) => r.workerId },
  ]);
}

export async function exportWorkersCsv(filters: {
  visibility?: VisibilityStatus;
  q?: string;
}): Promise<string> {
  const { rows } = await rostersService.listWorkersAdmin({
    ...filters,
    page: 1,
    limit: ROW_CAP + 1,
  });
  ensureUnderCap(rows.length, 'workers');
  return toCsv(rows, [
    { header: 'id', pick: (r) => r.id },
    { header: 'full_name', pick: (r) => r.fullName },
    { header: 'phone', pick: (r) => r.phone },
    { header: 'state_of_origin', pick: (r) => r.stateOfOrigin },
    { header: 'visibility_status', pick: (r) => r.visibilityStatus },
    { header: 'profile_completion_pct', pick: (r) => r.profileCompletionPct },
    { header: 'submitted_at', pick: (r) => r.submittedAt },
  ]);
}
