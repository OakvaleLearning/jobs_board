import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { EMPLOYER_ROLES } from '@oakvale/shared/roles.js';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { employers } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import {
  invoiceFiltersSchema,
  refundSchema,
  subscribeSchema,
} from '@oakvale/shared/schema/payment.js';
import * as paymentsService from './service.js';

function requireUserId(req: FastifyRequest): string {
  const sub = (req.user as { sub?: string } | undefined)?.sub;
  if (!sub) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
  return sub;
}

function getRole(req: FastifyRequest): string {
  const r = (req.user as { role?: string } | undefined)?.role;
  if (!r) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
  return r;
}

async function employerIdForUser(userId: string): Promise<string> {
  const e = await db.query.employers.findFirst({ where: eq(employers.userId, userId) });
  if (!e) throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  return e.id;
}

const placementIdParam = z.object({ placementId: z.string().uuid() });
const invoiceIdParam = z.object({ id: z.string().uuid() });
const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const paymentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /* Employer — create checkout for own placement */
  app.post(
    '/placements/:placementId/checkout',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const { placementId } = placementIdParam.parse(req.params);
      const userId = requireUserId(req);
      const employerId = await employerIdForUser(userId);
      const result = await paymentsService.openInvoiceForPlacement({
        placementId,
        requestedBy: userId,
      });
      if (result.invoice.employerId !== employerId) {
        throw new AppError({ code: 'FORBIDDEN', message: 'Not your placement.', statusCode: 403 });
      }
      return { data: { invoiceId: result.invoice.id, checkoutUrl: result.checkoutUrl } };
    },
  );

  /* Employer — invoices + subscription */
  app.get(
    '/invoices/me',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const employerId = await employerIdForUser(userId);
      const rows = await paymentsService.listInvoicesForEmployer(employerId);
      return { data: rows };
    },
  );

  app.get('/invoices/:id', { preHandler: app.requireAuth }, async (req) => {
    const { id } = invoiceIdParam.parse(req.params);
    const invoice = await paymentsService.getInvoiceForViewer({
      invoiceId: id,
      viewer: { sub: requireUserId(req), role: getRole(req) },
    });
    return { data: invoice };
  });

  app.post(
    '/subscriptions/checkout',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const input = subscribeSchema.parse(req.body);
      const userId = requireUserId(req);
      const employerId = await employerIdForUser(userId);
      const result = await paymentsService.openInvoiceForSubscription({
        employerId,
        plan: input.plan,
      });
      return {
        data: { subscriptionId: result.subscription.id, checkoutUrl: result.checkoutUrl },
      };
    },
  );

  app.get(
    '/subscriptions/me',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const employerId = await employerIdForUser(userId);
      const sub = await paymentsService.getSubscriptionForEmployer(employerId);
      return { data: sub };
    },
  );

  app.post(
    '/subscriptions/me/cancel',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const employerId = await employerIdForUser(userId);
      await paymentsService.cancelSubscriptionForEmployer(employerId);
      return { data: { ok: true } };
    },
  );

  /* Admin */
  app.get('/admin/invoices', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const filters = invoiceFiltersSchema.parse(req.query);
    const rows = await paymentsService.adminListInvoices(filters);
    return { data: rows, meta: { page: filters.page, limit: filters.limit, total: rows.length } };
  });

  app.get('/admin/payments', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const opts = pageQuerySchema.parse(req.query);
    const rows = await paymentsService.adminListPayments(opts);
    return { data: rows, meta: { ...opts, total: rows.length } };
  });

  app.get(
    '/admin/subscriptions',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const opts = z
        .object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })
        .parse(req.query);
      const rows = await paymentsService.adminListSubscriptions(opts);
      return { data: rows, meta: { ...opts, total: rows.length } };
    },
  );

  app.post(
    '/admin/invoices/:id/refund',
    { preHandler: app.requireRole('ADMIN') },
    async (req) => {
      const { id } = invoiceIdParam.parse(req.params);
      const input = refundSchema.parse(req.body);
      await paymentsService.refundInvoice({
        invoiceId: id,
        reason: input.reason,
        actorId: requireUserId(req),
      });
      return { data: { ok: true } };
    },
  );
};
