import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { AppError } from '@/shared/errors/app-error.js';
import type { Role } from '@oakvale/shared/roles.js';

async function verifyRequest(req: FastifyRequest): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    throw new AppError({ code: 'UNAUTHORIZED', message: 'Authentication required.', statusCode: 401 });
  }
}

export const requireAuth: preHandlerAsyncHookHandler = async (req: FastifyRequest) => {
  await verifyRequest(req);
};

export function requireRole(...allowed: Role[]): preHandlerAsyncHookHandler {
  return async (req: FastifyRequest) => {
    await verifyRequest(req);
    const role = (req.user as { role?: Role } | undefined)?.role;
    if (!role || !allowed.includes(role)) {
      throw new AppError({ code: 'FORBIDDEN', message: 'Insufficient permissions.', statusCode: 403 });
    }
  };
}
