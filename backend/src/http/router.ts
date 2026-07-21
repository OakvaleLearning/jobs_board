import type { FastifyInstance } from 'fastify';
import { authRoutes } from '@/modules/auth/routes.js';
import { workerRoutes } from '@/modules/workers/routes.js';
import { verificationRoutes } from '@/modules/verification/routes.js';
import { complianceRoutes } from '@/modules/compliance/routes.js';
import { employerRoutes } from '@/modules/employers/routes.js';
import { placementRoutes } from '@/modules/placements/routes.js';
import { paymentRoutes } from '@/modules/payments/routes.js';
import { stripeWebhookRoutes } from '@/modules/payments/webhooks/stripe-handler.js';
import { paystackWebhookRoutes } from '@/modules/payments/webhooks/paystack-handler.js';
import { adminRoutes } from '@/modules/admin/routes.js';
import { notificationRoutes } from '@/modules/notifications/routes.js';
import { contractRoutes } from '@/modules/contracts/routes.js';
import { complaintRoutes } from '@/modules/complaints/routes.js';
import { offerRoutes } from '@/modules/offers/routes.js';
import { messagingRoutes } from '@/modules/messaging/routes.js';

export async function mountRouter(app: FastifyInstance): Promise<void> {
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(workerRoutes, { prefix: '/workers' });
      await api.register(verificationRoutes, { prefix: '/verification' });
      await api.register(complianceRoutes, { prefix: '/compliance' });
      await api.register(employerRoutes, { prefix: '/employers' });
      await api.register(placementRoutes, { prefix: '/placements' });
      await api.register(paymentRoutes, { prefix: '/payments' });
      await api.register(adminRoutes, { prefix: '/admin' });
      await api.register(notificationRoutes, { prefix: '/notifications' });
      await api.register(contractRoutes, { prefix: '/contracts' });
      await api.register(complaintRoutes, { prefix: '/complaints' });
      await api.register(offerRoutes, { prefix: '/offers' });
      await api.register(messagingRoutes, { prefix: '/messaging' });
      await api.register(
        async (webhooks) => {
          await webhooks.register(stripeWebhookRoutes);
          await webhooks.register(paystackWebhookRoutes);
        },
        { prefix: '/webhooks' },
      );
    },
    { prefix: '/api/v1' },
  );
}
