/** §14.2 Payroll — internal NGN worker-payout ledger (isolated from employer payments). */
export const PAYROLL_RUN_STATUSES = ['DRAFT', 'APPROVED', 'PAID'] as const;
export type PayrollRunStatus = (typeof PAYROLL_RUN_STATUSES)[number];

export const WORKER_PAYOUT_STATUSES = ['PENDING', 'PAID'] as const;
export type WorkerPayoutStatus = (typeof WORKER_PAYOUT_STATUSES)[number];
