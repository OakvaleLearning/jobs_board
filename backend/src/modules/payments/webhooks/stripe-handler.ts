import type { FastifyInstance, FastifyRequest } from 'fastify';
import type Stripe from 'stripe';
import { AppError } from '@/shared/errors/app-error.js';
import { logger } from '@/shared/logger/logger.js';
import { verifyWebhook } from '../stripe/client.js';
import * as paymentsService from '../service.js';
import type { Currency } from '@oakvale/shared/enums/payment.js';

export async function stripeWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );

  app.post('/stripe', async (req: FastifyRequest, reply) => {
    const sig = req.headers['stripe-signature'];
    const raw = req.body as Buffer;
    if (!sig || typeof sig !== 'string' || !Buffer.isBuffer(raw)) {
      throw new AppError({
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: 'Missing signature or body.',
        statusCode: 400,
      });
    }
    const event = verifyWebhook(raw, sig);
    logger.info({ type: event.type, id: event.id }, 'Stripe webhook received');

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId =
          (session.metadata?.invoiceId as string | undefined) ?? null;
        const subscriptionId =
          (session.metadata?.subscriptionId as string | undefined) ?? null;
        if (subscriptionId && typeof session.subscription === 'string') {
          await paymentsService.linkProviderSubscriptionId(subscriptionId, session.subscription);
        }
        if (session.mode === 'payment' && invoiceId && session.payment_intent) {
          const paymentIntentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent.id;
          await paymentsService.markPaidFromWebhook({
            provider: 'STRIPE',
            providerPaymentId: paymentIntentId,
            providerInvoiceId: session.id,
            amountMinor: session.amount_total ?? 0,
            currency: (session.currency?.toUpperCase() as Currency) ?? 'GBP',
            rawEvent: event,
          });
        }
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice;
        const subId = typeof inv.subscription === 'string' ? inv.subscription : null;
        if (subId) {
          await paymentsService.recordSubscriptionEvent({
            providerSubscriptionId: subId,
            status: 'ACTIVE',
            currentPeriodStart: inv.period_start ? new Date(inv.period_start * 1000) : undefined,
            currentPeriodEnd: inv.period_end ? new Date(inv.period_end * 1000) : undefined,
            eventType: 'invoice.paid',
            rawEvent: event,
          });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await paymentsService.recordSubscriptionEvent({
          providerSubscriptionId: sub.id,
          status: sub.status === 'active' || sub.status === 'trialing' ? 'ACTIVE' : 'PAST_DUE',
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          eventType: event.type,
          rawEvent: event,
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await paymentsService.recordSubscriptionEvent({
          providerSubscriptionId: sub.id,
          status: 'CANCELLED',
          eventType: event.type,
          rawEvent: event,
        });
        break;
      }
      case 'charge.refunded': {
        // Refunds are admin-driven via service; nothing to do here beyond log
        break;
      }
      default:
        logger.debug({ type: event.type }, 'Unhandled Stripe event');
    }

    return reply.code(200).send({ received: true });
  });
}
