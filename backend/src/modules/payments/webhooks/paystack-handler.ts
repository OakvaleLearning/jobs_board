import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '@/shared/errors/app-error.js';
import { logger } from '@/shared/logger/logger.js';
import { verifyWebhook } from '../paystack/client.js';
import * as paymentsService from '../service.js';
import type { Currency } from '@oakvale/shared/enums/payment.js';

interface PaystackEnvelope {
  event: string;
  data: Record<string, unknown>;
}

export async function paystackWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );

  app.post('/paystack', async (req: FastifyRequest, reply) => {
    const sig = req.headers['x-paystack-signature'];
    const raw = req.body as Buffer;
    if (!sig || typeof sig !== 'string' || !Buffer.isBuffer(raw)) {
      throw new AppError({
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: 'Missing signature or body.',
        statusCode: 400,
      });
    }
    const event = verifyWebhook(raw, sig) as PaystackEnvelope;
    logger.info({ type: event.event }, 'Paystack webhook received');

    switch (event.event) {
      case 'charge.success': {
        const data = event.data as {
          reference: string;
          amount: number;
          currency: string;
          metadata?: { invoiceId?: string };
        };
        await paymentsService.markPaidFromWebhook({
          provider: 'PAYSTACK',
          providerPaymentId: data.reference,
          providerInvoiceId: data.reference,
          amountMinor: data.amount,
          currency: (data.currency?.toUpperCase() as Currency) ?? 'NGN',
          rawEvent: event,
        });
        break;
      }
      case 'subscription.create': {
        const data = event.data as {
          subscription_code: string;
          status: string;
          next_payment_date?: string;
          metadata?: { subscriptionId?: string };
        };
        const subId = data.metadata?.subscriptionId;
        if (subId) {
          await paymentsService.linkProviderSubscriptionId(subId, data.subscription_code);
        }
        await paymentsService.recordSubscriptionEvent({
          providerSubscriptionId: data.subscription_code,
          status: data.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
          currentPeriodEnd: data.next_payment_date ? new Date(data.next_payment_date) : undefined,
          eventType: event.event,
          rawEvent: event,
        });
        break;
      }
      case 'subscription.disable':
      case 'subscription.not_renew': {
        const data = event.data as { subscription_code: string };
        await paymentsService.recordSubscriptionEvent({
          providerSubscriptionId: data.subscription_code,
          status: event.event === 'subscription.disable' ? 'CANCELLED' : 'EXPIRED',
          eventType: event.event,
          rawEvent: event,
        });
        break;
      }
      default:
        logger.debug({ type: event.event }, 'Unhandled Paystack event');
    }

    return reply.code(200).send({ received: true });
  });
}
