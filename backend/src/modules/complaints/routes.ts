import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { AppError } from '@/shared/errors/app-error.js';
import {
  complaintAddNoteSchema,
  complaintAssignSchema,
  complaintFiltersSchema,
  complaintRaiseSchema,
  complaintResolveSchema,
} from '@oakvale/shared/schema/complaints.js';
import { COMPLAINT_STATUSES, type ComplaintStatus } from '@oakvale/shared/enums/complaints.js';
import * as complaintsService from './service.js';

function requireUserId(req: FastifyRequest): string {
  if (!req.user) {
    throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required', statusCode: 401 });
  }
  return req.user.sub;
}

export const complaintRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --- Worker / Employer: raise + list + detail ---
  app.post('/', { preHandler: app.requireAuth }, async (req) => {
    const input = complaintRaiseSchema.parse(req.body);
    const row = await complaintsService.raiseComplaint(input, requireUserId(req));
    return { data: row };
  });

  app.get('/me', { preHandler: app.requireAuth }, async (req) => {
    const rows = await complaintsService.listForUser(requireUserId(req));
    return { data: rows };
  });

  app.get('/:id', { preHandler: app.requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const result = await complaintsService.detail(id);
    return { data: result };
  });

  // --- Agent / Admin actions ---
  app.get('/admin', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const filters = complaintFiltersSchema.parse(req.query);
    const result = await complaintsService.adminList(filters, requireUserId(req));
    return result;
  });

  app.post('/admin/:id/acknowledge', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const { id } = req.params as { id: string };
    const row = await complaintsService.acknowledge(id, requireUserId(req));
    return { data: row };
  });

  app.post('/admin/:id/assign', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const { id } = req.params as { id: string };
    const input = complaintAssignSchema.parse(req.body);
    const row = await complaintsService.assign(id, input.agentId, requireUserId(req));
    return { data: row };
  });

  app.post('/admin/:id/status', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };
    if (!COMPLAINT_STATUSES.includes(status as ComplaintStatus)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Unknown complaint status',
        statusCode: 400,
      });
    }
    const row = await complaintsService.setStatus(id, status as ComplaintStatus, requireUserId(req));
    return { data: row };
  });

  app.post('/admin/:id/notes', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const { id } = req.params as { id: string };
    const input = complaintAddNoteSchema.parse(req.body);
    await complaintsService.addNote(id, input.note, requireUserId(req));
    return { data: { ok: true } };
  });

  app.post('/admin/:id/resolve', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const { id } = req.params as { id: string };
    const input = complaintResolveSchema.parse(req.body);
    const row = await complaintsService.resolve(id, input, requireUserId(req));
    return { data: row };
  });
};
