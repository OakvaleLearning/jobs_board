import { Queue, type QueueOptions } from 'bullmq';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

const connection = { url: env.REDIS_URL };

const baseOpts: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 1_000 },
    removeOnFail: { count: 5_000 },
  },
};

export const queues = {
  notifications: new Queue('notifications', baseOpts),
  welfareChecks: new Queue('welfare-checks', baseOpts),
  cpdReminders: new Queue('cpd-reminders', baseOpts),
  documentProcessing: new Queue('document-processing', baseOpts),
  replacementSla: new Queue('replacement-sla', baseOpts),
  dunning: new Queue('dunning', baseOpts),
  digest: new Queue('digest', baseOpts),
  contractRenewals: new Queue('contract-renewals', baseOpts),
  complaintsSla: new Queue('complaints-sla', baseOpts),
  prePlacementWelfare: new Queue('pre-placement-welfare', baseOpts),
  savedSearchSweep: new Queue('saved-search-sweep', baseOpts),
};

export type QueueName = keyof typeof queues;
