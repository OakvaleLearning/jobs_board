import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { AppError } from '@/shared/errors/app-error.js';
import {
  contractAmendSchema,
  contractFiltersSchema,
  contractRenewSchema,
  contractSignSchema,
  contractTemplateCreateSchema,
  contractTemplateUpdateSchema,
  contractCreateSchema,
} from '@oakvale/shared/schema/contracts.js';
import * as contractsService from './service.js';
import {
  createRenewal,
  listRenewalCandidates,
  previewRenewal,
} from './renewal.js';

function requireUserId(req: FastifyRequest): string {
  if (!req.user) {
    throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required', statusCode: 401 });
  }
  return req.user.sub;
}

function requireRole(req: FastifyRequest): string {
  if (!req.user) {
    throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required', statusCode: 401 });
  }
  return req.user.role;
}

export const contractRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --- Me (worker/employer): list + detail + sign ---
  app.get('/me', { preHandler: app.requireAuth }, async (req) => {
    const rows = await contractsService.listForUser(requireUserId(req), requireRole(req));
    return { data: rows };
  });

  app.get('/:id', { preHandler: app.requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const result = await contractsService.detail(id);
    return { data: result };
  });

  app.post('/:id/sign', { preHandler: app.requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const input = contractSignSchema.parse(req.body);
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip;
    const userAgent = req.headers['user-agent'] as string | undefined;
    const result = await contractsService.signContract({
      contractId: id,
      party: input.party,
      signerUserId: requireUserId(req),
      typedName: input.typedName,
      password: input.password,
      ipAddress,
      userAgent,
    });
    return { data: result };
  });

  // --- Admin: templates ---
  app.get('/admin/templates', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const { type, activeOnly } = req.query as { type?: string; activeOnly?: string };
    const rows = await contractsService.listTemplates({
      type: type as never,
      activeOnly: activeOnly === 'true',
    });
    return { data: rows };
  });

  app.post('/admin/templates', { preHandler: app.requireRole('ADMIN') }, async (req) => {
    const input = contractTemplateCreateSchema.parse(req.body);
    const row = await contractsService.createTemplate(input, requireUserId(req));
    return { data: row };
  });

  app.patch('/admin/templates/:id', { preHandler: app.requireRole('ADMIN') }, async (req) => {
    const { id } = req.params as { id: string };
    const input = contractTemplateUpdateSchema.parse(req.body);
    const row = await contractsService.updateTemplate(id, input, requireUserId(req));
    return { data: row };
  });

  // --- Admin: contracts ---
  app.get('/admin', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const filters = contractFiltersSchema.parse(req.query);
    const result = await contractsService.adminList(filters);
    return result;
  });

  app.post('/admin', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const input = contractCreateSchema.parse(req.body);
    const template = (await contractsService.listTemplates({ activeOnly: true })).find(
      (t) => t.id === input.templateId,
    );
    if (!template) {
      throw new AppError({
        code: 'CONTRACT_TEMPLATE_NOT_FOUND',
        message: 'Template not found',
        statusCode: 404,
      });
    }
    const row = await contractsService.createContract({
      type: template.type,
      templateId: template.id,
      placementId: input.placementId ?? null,
      employerId: input.employerId,
      workerId: input.workerId ?? null,
      expiresAt: input.expiresAt ?? null,
      extraVars: input.variables,
      createdBy: requireUserId(req),
    });
    return { data: row };
  });

  app.post('/admin/:id/terminate', { preHandler: app.requireRole('ADMIN') }, async (req) => {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };
    const row = await contractsService.terminate(id, reason ?? 'No reason given', requireUserId(req));
    return { data: row };
  });

  // --- Amendments ---
  app.post('/:id/amend', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const { id } = req.params as { id: string };
    const input = contractAmendSchema.parse(req.body);
    const result = await contractsService.amendContract({
      originalContractId: id,
      changedTerms: input.changedTerms,
      reason: input.reason,
      initiatedBy: requireUserId(req),
    });
    return { data: result };
  });

  app.get('/:id/amendments', { preHandler: app.requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const result = await contractsService.listAmendments(id);
    return { data: result };
  });

  // --- Renewals (Annual Partnership) ---
  app.get(
    '/admin/renewals/due',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { withinDays } = (req.query as { withinDays?: string }) ?? {};
      const days = withinDays ? Math.min(Math.max(parseInt(withinDays, 10) || 60, 1), 365) : 60;
      const rows = await listRenewalCandidates({ withinDays: days });
      return { data: rows };
    },
  );

  app.get(
    '/admin/renewals/:id/preview',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { id } = req.params as { id: string };
      const preview = await previewRenewal(id);
      return { data: preview };
    },
  );

  app.post(
    '/admin/:id/renew',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { id } = req.params as { id: string };
      const input = contractRenewSchema.parse(req.body);
      const result = await createRenewal({
        originalContractId: id,
        newPeriodStart: input.newPeriodStart,
        newPeriodEnd: input.newPeriodEnd,
        initiatedBy: requireUserId(req),
      });
      return { data: result };
    },
  );
};
