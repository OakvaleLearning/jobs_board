import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwtPlugin from '@fastify/jwt';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { loadEnv, type Env } from './shared/config/env.js';
import { logger } from './shared/logger/logger.js';
import { pingDb, sql } from './shared/db/client.js';
import { pingRedis, redis } from './shared/cache/redis.js';
import { queues } from './shared/queue/queues.js';
import { AppError } from './shared/errors/app-error.js';
import { mountRouter } from './http/router.js';
import { requireAuth, requireRole } from './http/middleware/auth.js';
import { startDocumentProcessingWorker } from './modules/workers/queues/document-processing.js';
import {
  registerCpdExpiryScheduler,
  startCpdExpiryWorker,
} from './modules/compliance/queues/cpd-expiry-scan.js';
import { registerVerificationSubscribers } from './modules/verification/subscribers.js';
import { registerComplianceSubscribers } from './modules/compliance/subscribers.js';
import { registerPlacementSubscribers } from './modules/placements/subscribers.js';
import { registerWelfareSubscribers } from './modules/placements/welfare-subscribers.js';
import { registerPaymentSubscribers } from './modules/payments/subscribers.js';
import { registerNotificationSubscribers } from './modules/notifications/subscribers.js';
import { seedDefaults as seedNotificationTemplates } from './modules/notifications/template-store.js';
import { registerContractSubscribers } from './modules/contracts/subscribers.js';
import { registerComplaintSubscribers } from './modules/complaints/subscribers.js';
import { registerOfferSubscribers } from './modules/offers/subscribers.js';
import { registerEmployerSubscribers } from './modules/employers/subscribers.js';
import { registerWorkerSubscribers } from './modules/workers/subscribers.js';
import { startNotificationsWorker } from './modules/notifications/queues/notifications-worker.js';
import {
  registerDunningScheduler,
  startDunningWorker,
} from './modules/notifications/queues/dunning-scheduler.js';
import {
  registerDigestScheduler,
  startDigestWorker,
} from './modules/notifications/queues/digest-scheduler.js';
import { startWelfareCheckWorker } from './modules/placements/queues/welfare-checks.js';
import {
  registerReplacementSlaScheduler,
  startReplacementSlaWorker,
} from './modules/placements/queues/replacement-sla.js';
import {
  registerRenewalScanScheduler,
  startRenewalScanWorker,
} from './modules/contracts/queues/renewal-scan.js';
import {
  registerSavedSearchSweepScheduler,
  startSavedSearchSweepWorker,
} from './modules/employers/queues/saved-search-sweep.js';
import type { Role } from '@oakvale/shared/roles.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
    requireAuth: typeof requireAuth;
    requireRole: typeof requireRole;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: Role };
    user: { sub: string; role: Role };
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv();
  // Pin the instance's logger generic to FastifyBaseLogger so the instance
  // type matches FastifyInstance everywhere (pino's Logger satisfies it).
  const app = Fastify({
    logger: logger as FastifyBaseLogger,
    disableRequestLogging: false,
    trustProxy: true,
  });

  app.decorate('config', env);
  app.decorate('requireAuth', requireAuth);
  app.decorate('requireRole', requireRole);

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(sensible);
  await app.register(jwtPlugin, { secret: env.JWT_ACCESS_SECRET });
  await app.register(rateLimit, {
    global: false,
    redis: redis,
    max: 100,
    timeWindow: '1 minute',
    // On limit-exceeded the plugin throws an error with statusCode 429; the global
    // error handler below maps it to the standard RATE_LIMITED envelope.
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      req.log.warn({ err }, 'AppError');
      return reply.status(err.statusCode).send(err.toJSON());
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          statusCode: 400,
          details: { issues: err.flatten().fieldErrors },
        },
      });
    }
    // @fastify/rate-limit rejects flow through here when a custom error handler is set.
    if ((err as { statusCode?: number }).statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please try again later.',
          statusCode: 429,
        },
      });
    }
    req.log.error({ err }, 'Unhandled error');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', statusCode: 500 },
    });
  });

  app.get('/health', async () => {
    const [dbOk, redisOk] = await Promise.all([pingDb(), pingRedis()]);
    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      db: dbOk ? 'ok' : 'down',
      redis: redisOk ? 'ok' : 'down',
    };
  });

  await mountRouter(app);

  registerVerificationSubscribers();
  registerComplianceSubscribers();
  registerPlacementSubscribers();
  registerWelfareSubscribers();
  registerPaymentSubscribers();
  registerNotificationSubscribers();
  registerContractSubscribers();
  registerComplaintSubscribers();
  registerOfferSubscribers();
  registerEmployerSubscribers();
  registerWorkerSubscribers();

  // Ensure every notification kind has a DB template row (idempotent; never overwrites edits).
  await seedNotificationTemplates();

  const docWorker = startDocumentProcessingWorker();
  const cpdWorker = startCpdExpiryWorker();
  const welfareWorker = startWelfareCheckWorker();
  const slaWorker = startReplacementSlaWorker();
  const notificationsWorker = startNotificationsWorker();
  const dunningWorker = startDunningWorker();
  const digestWorker = startDigestWorker();
  const renewalScanWorker = startRenewalScanWorker();
  const savedSearchSweepWorker = startSavedSearchSweepWorker();
  await registerCpdExpiryScheduler();
  await registerReplacementSlaScheduler();
  await registerDunningScheduler();
  await registerDigestScheduler();
  await registerRenewalScanScheduler();
  await registerSavedSearchSweepScheduler();

  app.addHook('onClose', async () => {
    // Shutdown order: queue workers → queue producers → redis → postgres.
    await Promise.allSettled([
      docWorker.close(),
      cpdWorker.close(),
      welfareWorker.close(),
      slaWorker.close(),
      notificationsWorker.close(),
      dunningWorker.close(),
      digestWorker.close(),
      renewalScanWorker.close(),
      savedSearchSweepWorker.close(),
    ]);
    await Promise.allSettled(Object.values(queues).map((q) => q.close()));
    await redis.quit().catch(() => redis.disconnect());
    await sql.end({ timeout: 5 });
  });

  return app;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp();

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, 'Shutting down');
      void app
        .close()
        .then(() => process.exit(0))
        .catch((err: unknown) => {
          app.log.error({ err }, 'Shutdown failed');
          process.exit(1);
        });
    });
  }

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error({ err }, 'Failed to start');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
