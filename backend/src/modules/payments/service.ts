import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  employers,
  invoices,
  paymentIntents,
  payments,
  subscriptionEvents,
  subscriptions,
  users,
  type Invoice,
  type Subscription,
} from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';
import { recordAudit } from '@/shared/audit/record.js';
import { loadEnv } from '@/shared/config/env.js';
import {
  PLACEMENT_FEE_BY_PIPELINE,
  PLAN_PRICING,
  type Currency,
  type InvoiceStatus,
  type PaymentProvider,
  type SubscriptionPlan,
} from '@oakvale/shared/enums/payment.js';
import * as stripeClient from './stripe/client.js';
import * as paystackClient from './paystack/client.js';
import * as placementsService from '@/modules/placements/service.js';
import { deriveTypeFlags, getEmployerType } from '@/modules/admin/employer-types.service.js';

interface InvoiceFilters {
  status?: InvoiceStatus;
  pipeline?: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
  provider?: PaymentProvider;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

function frontendUrl(): string {
  return loadEnv().FRONTEND_URL;
}

/**
 * CLAUDE.md "What NOT to Do" bans synchronous external API calls in request
 * handlers. Checkout-session creation is the documented exception: the
 * redirect URL must be returned to the client in the same request. The calls
 * are bounded (15s provider timeouts, see stripe/client.ts and
 * paystack/client.ts) and failures surface as typed PAYMENT_PROVIDER_ERROR
 * 502s; the just-created invoice is voided so a retry starts clean.
 */
async function createCheckoutOrVoidInvoice<T>(
  invoiceId: string,
  create: () => Promise<T>,
): Promise<T> {
  try {
    return await create();
  } catch (err) {
    try {
      await db.update(invoices).set({ status: 'VOID' }).where(eq(invoices.id, invoiceId));
    } catch (voidErr) {
      logger.error({ err: voidErr, invoiceId }, 'Failed to void invoice after provider error');
    }
    if (err instanceof AppError) throw err;
    throw new AppError({
      code: 'PAYMENT_PROVIDER_ERROR',
      message: 'Payment provider request failed.',
      statusCode: 502,
      cause: err,
    });
  }
}

async function userEmailFor(employerId: string): Promise<string> {
  const row = await db
    .select({ email: users.email })
    .from(employers)
    .innerJoin(users, eq(users.id, employers.userId))
    .where(eq(employers.id, employerId))
    .limit(1);
  if (!row[0]) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  return row[0].email;
}

export async function openInvoiceForPlacement(input: {
  placementId: string;
  requestedBy: string;
}): Promise<{ invoice: Invoice; checkoutUrl: string }> {
  const placement = await placementsService.getPlacementOrThrow(input.placementId);
  if (placement.status !== 'PENDING_PAYMENT') {
    throw new AppError({
      code: 'INVALID_PLACEMENT_TRANSITION',
      message: 'Placement is not awaiting payment.',
      statusCode: 409,
    });
  }
  const existing = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.placementId, input.placementId), eq(invoices.status, 'OPEN')))
    .limit(1);
  if (existing[0]) {
    const intent = await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.invoiceId, existing[0].id))
      .orderBy(desc(paymentIntents.createdAt))
      .limit(1);
    if (intent[0]?.checkoutUrl) {
      return { invoice: existing[0], checkoutUrl: intent[0].checkoutUrl };
    }
  }

  const pricing = PLACEMENT_FEE_BY_PIPELINE[placement.pipelineType];
  const email = await userEmailFor(placement.employerId);

  const [invoice] = await db
    .insert(invoices)
    .values({
      employerId: placement.employerId,
      placementId: placement.id,
      pipeline: placement.pipelineType,
      purpose: 'PLACEMENT_FEE',
      status: 'OPEN',
      currency: pricing.currency,
      amountMinor: pricing.amountMinor,
      provider: pricing.provider,
    })
    .returning();
  if (!invoice) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to open invoice.', statusCode: 500 });
  }

  const successUrl = `${frontendUrl()}/employer/individual-employer/billing/success?placementId=${placement.id}`;
  const cancelUrl = `${frontendUrl()}/employer/individual-employer/billing/cancel`;

  const { intentId, checkoutUrl } = await createCheckoutOrVoidInvoice(invoice.id, async () => {
    const metadata = {
      invoiceId: invoice.id,
      placementId: placement.id,
      employerId: placement.employerId,
      purpose: 'PLACEMENT_FEE',
    };
    if (pricing.provider === 'STRIPE') {
      const session = await stripeClient.createCheckoutSession({
        invoiceId: invoice.id,
        amountMinor: pricing.amountMinor,
        currency: pricing.currency,
        customerEmail: email,
        description: `Placement fee · ${placement.id.slice(0, 8)}`,
        successUrl,
        cancelUrl,
        metadata,
      });
      return { intentId: session.id, checkoutUrl: session.url };
    }
    const txn = await paystackClient.initializeTransaction({
      invoiceId: invoice.id,
      amountMinor: pricing.amountMinor,
      currency: pricing.currency,
      customerEmail: email,
      callbackUrl: successUrl,
      metadata,
    });
    return { intentId: txn.reference, checkoutUrl: txn.authorizationUrl };
  });

  await db.insert(paymentIntents).values({
    invoiceId: invoice.id,
    provider: pricing.provider,
    providerIntentId: intentId,
    checkoutUrl,
  });
  await db
    .update(invoices)
    .set({ providerInvoiceId: intentId })
    .where(eq(invoices.id, invoice.id));

  events.emit('invoice.opened', {
    invoiceId: invoice.id,
    employerId: placement.employerId,
    purpose: 'PLACEMENT_FEE',
    amountMinor: pricing.amountMinor,
  });
  logger.info({ invoiceId: invoice.id, placementId: placement.id }, 'Placement invoice opened');

  return { invoice, checkoutUrl };
}

export async function openInvoiceForSubscription(input: {
  employerId: string;
  plan: SubscriptionPlan;
}): Promise<{ invoice: Invoice; subscription: Subscription; checkoutUrl: string }> {
  const employer = await db.query.employers.findFirst({ where: eq(employers.id, input.employerId) });
  if (!employer) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  // Pricing/gateway + pipeline are driven by the configurable employer type (§5),
  // falling back to the legacy per-plan constants for pricing only.
  const typeConfig = await getEmployerType(employer.employerTypeId);
  const { pipeline } = deriveTypeFlags(typeConfig);

  // Plan/pipeline guard against the two launch annual plans.
  if (
    (input.plan === 'INDIVIDUAL_EMPLOYER_ANNUAL' && pipeline === 'CORPORATE') ||
    (input.plan === 'CORPORATE_ANNUAL' && pipeline === 'INDIVIDUAL_EMPLOYER')
  ) {
    throw new AppError({
      code: 'WRONG_EMPLOYER_TYPE',
      message: 'Plan does not match employer pipeline.',
      statusCode: 400,
    });
  }

  const pricing = (typeConfig.pricing?.subscription ?? PLAN_PRICING[input.plan]) as {
    amountMinor: number;
    currency: Currency;
    provider: PaymentProvider;
  };
  const email = await userEmailFor(employer.id);

  const [subscription] = await db
    .insert(subscriptions)
    .values({
      employerId: employer.id,
      plan: input.plan,
      provider: pricing.provider,
      status: 'PAST_DUE',
    })
    .returning();
  if (!subscription) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create subscription.', statusCode: 500 });
  }

  const [invoice] = await db
    .insert(invoices)
    .values({
      employerId: employer.id,
      subscriptionId: subscription.id,
      pipeline,
      purpose: 'SUBSCRIPTION',
      status: 'OPEN',
      currency: pricing.currency,
      amountMinor: pricing.amountMinor,
      provider: pricing.provider,
    })
    .returning();
  if (!invoice) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to open invoice.', statusCode: 500 });
  }

  const successUrl = `${frontendUrl()}/employer/billing?subscribed=1`;
  const cancelUrl = `${frontendUrl()}/employer/billing?cancelled=1`;
  const env = loadEnv();

  const { intentId, checkoutUrl } = await createCheckoutOrVoidInvoice(invoice.id, async () => {
    const metadata = {
      invoiceId: invoice.id,
      subscriptionId: subscription.id,
      employerId: employer.id,
      purpose: 'SUBSCRIPTION',
    };
    if (pricing.provider === 'STRIPE') {
      if (!env.STRIPE_PRICE_INDIVIDUAL_EMPLOYER_ANNUAL) {
        throw new AppError({
          code: 'PAYMENT_PROVIDER_ERROR',
          message: 'Stripe price ID is not configured.',
          statusCode: 503,
        });
      }
      const session = await stripeClient.createSubscriptionSession({
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
        priceId: env.STRIPE_PRICE_INDIVIDUAL_EMPLOYER_ANNUAL,
        customerEmail: email,
        successUrl,
        cancelUrl,
        metadata,
      });
      return { intentId: session.id, checkoutUrl: session.url };
    }
    if (!env.PAYSTACK_PLAN_CORPORATE_ANNUAL) {
      throw new AppError({
        code: 'PAYMENT_PROVIDER_ERROR',
        message: 'Paystack plan code is not configured.',
        statusCode: 503,
      });
    }
    const txn = await paystackClient.initializeSubscription({
      invoiceId: invoice.id,
      subscriptionId: subscription.id,
      planCode: env.PAYSTACK_PLAN_CORPORATE_ANNUAL,
      customerEmail: email,
      callbackUrl: successUrl,
      metadata,
    });
    return { intentId: txn.reference, checkoutUrl: txn.authorizationUrl };
  });

  await db.insert(paymentIntents).values({
    invoiceId: invoice.id,
    provider: pricing.provider,
    providerIntentId: intentId,
    checkoutUrl,
  });

  return { invoice, subscription, checkoutUrl };
}

export async function markPaidFromWebhook(input: {
  provider: PaymentProvider;
  providerPaymentId: string;
  providerInvoiceId: string | null;
  amountMinor: number;
  currency: Currency;
  rawEvent: unknown;
}): Promise<void> {
  const existing = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.provider, input.provider),
        eq(payments.providerPaymentId, input.providerPaymentId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    logger.info(
      { provider: input.provider, id: input.providerPaymentId },
      'Payment already recorded; idempotent no-op',
    );
    return;
  }

  let invoice: Invoice | undefined;
  if (input.providerInvoiceId) {
    const rows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.providerInvoiceId, input.providerInvoiceId))
      .limit(1);
    invoice = rows[0];
  }
  if (!invoice) {
    logger.warn(
      { provider: input.provider, providerInvoiceId: input.providerInvoiceId },
      'Webhook payment has no matching invoice; ignored',
    );
    return;
  }
  if (invoice.status === 'PAID') {
    logger.info({ invoiceId: invoice.id }, 'Invoice already PAID; idempotent no-op');
    return;
  }

  await db.insert(payments).values({
    invoiceId: invoice.id,
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    status: 'SUCCEEDED',
    capturedAt: new Date(),
    rawEvent: input.rawEvent as Record<string, unknown>,
  });
  await db
    .update(invoices)
    .set({ status: 'PAID', paidAt: new Date() })
    .where(eq(invoices.id, invoice.id));

  events.emit('invoice.paid', {
    invoiceId: invoice.id,
    employerId: invoice.employerId,
    placementId: invoice.placementId,
  });

  if (invoice.purpose === 'PLACEMENT_FEE' && invoice.placementId) {
    try {
      await placementsService.activatePlacement(invoice.placementId, null);
    } catch (err) {
      logger.error({ err, invoiceId: invoice.id }, 'Failed to activate placement from webhook');
    }
  }
}

export async function recordSubscriptionEvent(input: {
  providerSubscriptionId: string;
  status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  eventType: string;
  rawEvent: unknown;
}): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.providerSubscriptionId, input.providerSubscriptionId),
  });
  if (!sub) {
    logger.warn(
      { providerSubscriptionId: input.providerSubscriptionId },
      'Subscription event has no matching row; ignored',
    );
    return;
  }
  const patch: Partial<Subscription> = {};
  if (input.status) patch.status = input.status;
  if (input.currentPeriodStart) patch.currentPeriodStart = input.currentPeriodStart;
  if (input.currentPeriodEnd) patch.currentPeriodEnd = input.currentPeriodEnd;
  if (typeof input.cancelAtPeriodEnd === 'boolean') patch.cancelAtPeriodEnd = input.cancelAtPeriodEnd;
  if (Object.keys(patch).length) {
    await db.update(subscriptions).set(patch).where(eq(subscriptions.id, sub.id));
  }
  await db.insert(subscriptionEvents).values({
    subscriptionId: sub.id,
    eventType: input.eventType,
    rawEvent: input.rawEvent as Record<string, unknown>,
  });
  if (input.status === 'ACTIVE' && sub.status !== 'ACTIVE') {
    events.emit('subscription.activated', {
      subscriptionId: sub.id,
      employerId: sub.employerId,
      plan: sub.plan,
    });
  }
  if (input.status === 'CANCELLED' && sub.status !== 'CANCELLED') {
    events.emit('subscription.cancelled', { subscriptionId: sub.id, employerId: sub.employerId });
  }
}

export async function linkProviderSubscriptionId(
  subscriptionId: string,
  providerSubscriptionId: string,
): Promise<void> {
  await db
    .update(subscriptions)
    .set({ providerSubscriptionId })
    .where(eq(subscriptions.id, subscriptionId));
}

export async function refundInvoice(input: {
  invoiceId: string;
  reason: string;
  actorId: string;
}): Promise<void> {
  const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, input.invoiceId) });
  if (!invoice) {
    throw new AppError({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.', statusCode: 404 });
  }
  if (invoice.status !== 'PAID') {
    throw new AppError({
      code: 'CONFLICT',
      message: 'Only PAID invoices can be refunded.',
      statusCode: 409,
    });
  }
  const paymentRow = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoice.id))
    .orderBy(desc(payments.capturedAt))
    .limit(1);
  if (!paymentRow[0]) {
    throw new AppError({ code: 'CONFLICT', message: 'No payment to refund.', statusCode: 409 });
  }
  if (invoice.provider === 'STRIPE') {
    await stripeClient.refundPayment(paymentRow[0].providerPaymentId);
  } else {
    await paystackClient.refundTransaction(paymentRow[0].providerPaymentId);
  }
  await db.update(invoices).set({ status: 'REFUNDED' }).where(eq(invoices.id, invoice.id));
  await db
    .update(payments)
    .set({ status: 'REFUNDED' })
    .where(eq(payments.id, paymentRow[0].id));
  events.emit('invoice.refunded', {
    invoiceId: invoice.id,
    employerId: invoice.employerId,
    reason: input.reason,
  });
  logger.info({ invoiceId: invoice.id, actorId: input.actorId }, 'Invoice refunded');
  void recordAudit({
    actorId: input.actorId,
    action: 'invoice.refunded',
    targetType: 'invoice',
    targetId: invoice.id,
    metadata: { reason: input.reason, amountMinor: invoice.amountMinor, currency: invoice.currency },
  });
}

export async function cancelSubscriptionForEmployer(employerId: string): Promise<void> {
  const sub = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.employerId, employerId), eq(subscriptions.status, 'ACTIVE')))
    .limit(1);
  if (!sub[0]) {
    throw new AppError({
      code: 'SUBSCRIPTION_NOT_FOUND',
      message: 'No active subscription.',
      statusCode: 404,
    });
  }
  if (!sub[0].providerSubscriptionId) {
    await db
      .update(subscriptions)
      .set({ status: 'CANCELLED', cancelAtPeriodEnd: true })
      .where(eq(subscriptions.id, sub[0].id));
    return;
  }
  if (sub[0].provider === 'STRIPE') {
    await stripeClient.cancelSubscriptionAtPeriodEnd(sub[0].providerSubscriptionId);
  }
  // Paystack disable requires the email token returned from the subscription;
  // we mark cancel_at_period_end locally and rely on the webhook to confirm.
  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true })
    .where(eq(subscriptions.id, sub[0].id));
}

export async function listInvoicesForEmployer(employerId: string) {
  return db
    .select()
    .from(invoices)
    .where(eq(invoices.employerId, employerId))
    .orderBy(desc(invoices.createdAt));
}

/**
 * Business Rule #3 — a placement may only be activated once its placement-fee invoice is PAID.
 * Used to guard the manual admin activation route (the webhook path already activates only after
 * marking the invoice PAID).
 */
export async function isPlacementFeePaid(placementId: string): Promise<boolean> {
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.placementId, placementId),
        eq(invoices.purpose, 'PLACEMENT_FEE'),
        eq(invoices.status, 'PAID'),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function getSubscriptionForEmployer(employerId: string): Promise<Subscription | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.employerId, employerId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function hasActiveSubscription(employerId: string): Promise<boolean> {
  const sub = await getSubscriptionForEmployer(employerId);
  return sub?.status === 'ACTIVE';
}

export async function getInvoiceForViewer(input: {
  invoiceId: string;
  viewer: { sub: string; role: string };
}): Promise<Invoice> {
  const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, input.invoiceId) });
  if (!invoice) {
    throw new AppError({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.', statusCode: 404 });
  }
  if (input.viewer.role === 'ADMIN' || input.viewer.role === 'AGENT') return invoice;
  const employer = await db.query.employers.findFirst({
    where: eq(employers.userId, input.viewer.sub),
  });
  if (!employer || employer.id !== invoice.employerId) {
    throw new AppError({ code: 'FORBIDDEN', message: 'Not your invoice.', statusCode: 403 });
  }
  return invoice;
}

export async function adminListInvoices(filters: InvoiceFilters) {
  const conditions = [] as Array<ReturnType<typeof eq>>;
  if (filters.status) conditions.push(eq(invoices.status, filters.status));
  if (filters.pipeline) conditions.push(eq(invoices.pipeline, filters.pipeline));
  if (filters.provider) conditions.push(eq(invoices.provider, filters.provider));
  if (filters.from) conditions.push(gte(invoices.createdAt, new Date(filters.from)));
  if (filters.to) conditions.push(lte(invoices.createdAt, new Date(filters.to)));
  const where = conditions.length ? and(...conditions) : undefined;
  const offset = (filters.page - 1) * filters.limit;
  const rows = await db
    .select()
    .from(invoices)
    .where(where)
    .orderBy(desc(invoices.createdAt))
    .limit(filters.limit)
    .offset(offset);
  return rows;
}

export async function adminListPayments(opts: { page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit;
  return db
    .select()
    .from(payments)
    .orderBy(desc(payments.capturedAt))
    .limit(opts.limit)
    .offset(offset);
}

export async function adminListSubscriptions(opts: { page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit;
  return db
    .select()
    .from(subscriptions)
    .orderBy(desc(subscriptions.createdAt))
    .limit(opts.limit)
    .offset(offset);
}

export async function listOverdueCorporate() {
  return db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.pipeline, 'CORPORATE'),
        sql`status IN ('OPEN','PAST_DUE')`,
        sql`due_at < now()`,
      ),
    );
}

export async function markPastDue(invoiceId: string): Promise<void> {
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
  if (!inv) return;
  if (inv.status === 'PAST_DUE') return;
  await db.update(invoices).set({ status: 'PAST_DUE' }).where(eq(invoices.id, invoiceId));
  events.emit('invoice.pastDue', { invoiceId, employerId: inv.employerId });
}
