import { and, desc, eq, sql } from 'drizzle-orm';
import { verify as argonVerify } from '@node-rs/argon2';
import { db } from '@/shared/db/client.js';
import {
  contractAmendments,
  contractSignatures,
  contractTemplates,
  contracts,
  employers,
  employerContacts,
  placements,
  users,
  workers,
  workerPersonalInfo,
} from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import { recordAudit } from '@/shared/audit/record.js';
import {
  partiesForContractType,
  type ContractStatus,
  type ContractType,
  type SignatureMethod,
  type SignatureParty,
} from '@oakvale/shared/enums/contracts.js';
import type {
  ContractTemplateCreateInput,
  ContractTemplateUpdateInput,
} from '@oakvale/shared/schema/contracts.js';
import { extractVariables, renderTemplate, type TemplateVars } from './template-engine.js';
import { getEmployerType } from '@/modules/admin/employer-types.service.js';

const AWAITING_BY_PARTY: Record<SignatureParty, ContractStatus> = {
  WORKER: 'AWAITING_WORKER',
  EMPLOYER: 'AWAITING_EMPLOYER',
  OAKVALE: 'AWAITING_EMPLOYER', // Oakvale signs in parallel with employer in service/partnership contracts
};

/* --------------------------------- templates -------------------------------- */

export async function createTemplate(input: ContractTemplateCreateInput, createdBy: string) {
  const variables = input.variables.length ? input.variables : extractVariables(input.body);
  const [row] = await db
    .insert(contractTemplates)
    .values({
      type: input.type,
      name: input.name,
      version: input.version ?? 1,
      body: input.body,
      variables,
      notes: input.notes,
      isActive: true,
      createdBy,
    })
    .returning();
  if (!row) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create template.', statusCode: 500 });
  }
  await recordAudit({
    actorId: createdBy,
    action: 'contract_template.created',
    targetType: 'contract_template',
    targetId: row.id,
    metadata: { type: row.type, version: row.version },
  });
  return row;
}

export async function updateTemplate(
  templateId: string,
  input: ContractTemplateUpdateInput,
  actorId: string,
) {
  const existing = await db.query.contractTemplates.findFirst({
    where: eq(contractTemplates.id, templateId),
  });
  if (!existing) {
    throw new AppError({
      code: 'CONTRACT_TEMPLATE_NOT_FOUND',
      message: 'Contract template not found',
      statusCode: 404,
    });
  }
  const variables =
    input.variables ?? (input.body ? extractVariables(input.body) : existing.variables);
  const [row] = await db
    .update(contractTemplates)
    .set({
      ...(input.type ? { type: input.type } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.version !== undefined ? { version: input.version } : {}),
      ...(input.body ? { body: input.body } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      variables,
    })
    .where(eq(contractTemplates.id, templateId))
    .returning();
  await recordAudit({
    actorId,
    action: 'contract_template.updated',
    targetType: 'contract_template',
    targetId: templateId,
    metadata: { changes: Object.keys(input) },
  });
  return row;
}

export async function listTemplates(opts: { type?: ContractType; activeOnly?: boolean } = {}) {
  const whereClauses = [];
  if (opts.type) whereClauses.push(eq(contractTemplates.type, opts.type));
  if (opts.activeOnly) whereClauses.push(eq(contractTemplates.isActive, true));
  return db
    .select()
    .from(contractTemplates)
    .where(whereClauses.length ? and(...whereClauses) : undefined)
    .orderBy(desc(contractTemplates.updatedAt));
}

async function loadActiveTemplate(type: ContractType) {
  return db.query.contractTemplates.findFirst({
    where: and(eq(contractTemplates.type, type), eq(contractTemplates.isActive, true)),
    orderBy: [desc(contractTemplates.version)],
  });
}

/* --------------------------------- contracts -------------------------------- */

interface ContractCreateOpts {
  type: ContractType;
  templateId?: string;
  placementId?: string | null;
  employerId?: string | null;
  workerId?: string | null;
  expiresAt?: string | null;
  extraVars?: TemplateVars;
  createdBy: string | null;
}

async function gatherDefaultVars(opts: {
  placementId?: string | null;
  employerId?: string | null;
  workerId?: string | null;
}): Promise<TemplateVars> {
  const vars: TemplateVars = {
    'date.today': new Date().toISOString().slice(0, 10),
    'oakvale.entity': 'Oakvale Learning Limited',
  };
  if (opts.employerId) {
    const employer = await db.query.employers.findFirst({
      where: eq(employers.id, opts.employerId),
    });
    if (employer) {
      vars['employer.id'] = employer.id;
      vars['employer.orgName'] = employer.orgName ?? '';
      vars['employer.type'] = (await getEmployerType(employer.employerTypeId)).slug;
    }
    const primary = await db
      .select()
      .from(employerContacts)
      .where(and(eq(employerContacts.employerId, opts.employerId), eq(employerContacts.isPrimary, true)))
      .limit(1);
    if (primary[0]) {
      vars['employer.contactName'] = primary[0].name;
      vars['employer.contactEmail'] = primary[0].email ?? '';
    }
  }
  if (opts.workerId) {
    const worker = await db.query.workers.findFirst({ where: eq(workers.id, opts.workerId) });
    const info = await db.query.workerPersonalInfo.findFirst({
      where: eq(workerPersonalInfo.workerId, opts.workerId),
    });
    if (worker) vars['worker.id'] = worker.id;
    if (info?.fullName) vars['worker.fullName'] = info.fullName;
    if (info?.phone) vars['worker.phone'] = info.phone;
  }
  if (opts.placementId) {
    const placement = await db.query.placements.findFirst({
      where: eq(placements.id, opts.placementId),
    });
    if (placement) {
      vars['placement.id'] = placement.id;
      vars['placement.pipelineType'] = placement.pipelineType;
      if (placement.guaranteeExpiresAt)
        vars['placement.guaranteeUntil'] = placement.guaranteeExpiresAt
          .toISOString()
          .slice(0, 10);
    }
  }
  return vars;
}

export async function createContract(opts: ContractCreateOpts) {
  // §5: an employer type may restrict which contract types apply to it.
  if (opts.employerId) {
    const employer = await db.query.employers.findFirst({
      where: eq(employers.id, opts.employerId),
    });
    if (employer?.employerTypeId) {
      const type = await getEmployerType(employer.employerTypeId);
      if (type.applicableContractTypes.length > 0 && !type.applicableContractTypes.includes(opts.type)) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: `Contract type ${opts.type} is not applicable to this employer type.`,
          statusCode: 400,
        });
      }
    }
  }

  const template = opts.templateId
    ? await db.query.contractTemplates.findFirst({
        where: eq(contractTemplates.id, opts.templateId),
      })
    : await loadActiveTemplate(opts.type);
  if (!template) {
    throw new AppError({
      code: 'CONTRACT_TEMPLATE_NOT_FOUND',
      message: `No active template for type ${opts.type}`,
      statusCode: 404,
    });
  }

  const defaults = await gatherDefaultVars({
    placementId: opts.placementId,
    employerId: opts.employerId,
    workerId: opts.workerId,
  });
  const vars: TemplateVars = { ...defaults, ...(opts.extraVars ?? {}) };
  const bodyRendered = renderTemplate(template.body, vars);

  const parties = partiesForContractType(opts.type);
  // WORKER_PLACEMENT begins awaiting worker; service/partnership begin awaiting employer
  const initialStatus: ContractStatus = parties.includes('WORKER')
    ? 'AWAITING_WORKER'
    : 'AWAITING_EMPLOYER';

  const [row] = await db
    .insert(contracts)
    .values({
      type: opts.type,
      templateId: template.id,
      templateVersion: template.version,
      placementId: opts.placementId ?? null,
      employerId: opts.employerId ?? null,
      workerId: opts.workerId ?? null,
      bodyRendered,
      status: initialStatus,
      expiresAt: opts.expiresAt ? new Date(opts.expiresAt) : null,
      createdBy: opts.createdBy ?? null,
    })
    .returning();
  if (!row) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to draft contract.', statusCode: 500 });
  }

  await recordAudit({
    actorId: opts.createdBy ?? null,
    action: 'contract.drafted',
    targetType: 'contract',
    targetId: row.id,
    metadata: { type: row.type, placementId: row.placementId },
  });
  events.emit('contract.drafted', {
    contractId: row.id,
    type: row.type,
    placementId: row.placementId,
  });
  return row;
}

export async function detail(contractId: string) {
  const contract = await db.query.contracts.findFirst({ where: eq(contracts.id, contractId) });
  if (!contract) {
    throw new AppError({
      code: 'CONTRACT_NOT_FOUND',
      message: 'Contract not found',
      statusCode: 404,
    });
  }
  const sigs = await db
    .select()
    .from(contractSignatures)
    .where(eq(contractSignatures.contractId, contractId))
    .orderBy(desc(contractSignatures.signedAt));
  return { contract, signatures: sigs };
}

export interface SignOpts {
  contractId: string;
  party: SignatureParty;
  signerUserId: string;
  typedName: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  method?: SignatureMethod;
}

export async function signContract(opts: SignOpts) {
  const contract = await db.query.contracts.findFirst({
    where: eq(contracts.id, opts.contractId),
  });
  if (!contract) {
    throw new AppError({
      code: 'CONTRACT_NOT_FOUND',
      message: 'Contract not found',
      statusCode: 404,
    });
  }
  if (
    contract.status === 'FULLY_EXECUTED' ||
    contract.status === 'TERMINATED' ||
    contract.status === 'SUPERSEDED'
  ) {
    throw new AppError({
      code: 'CONTRACT_NOT_SIGNABLE',
      message: `Contract in status ${contract.status} cannot be signed`,
      statusCode: 409,
    });
  }
  const expected = partiesForContractType(contract.type);
  if (!expected.includes(opts.party)) {
    throw new AppError({
      code: 'CONTRACT_PARTY_MISMATCH',
      message: `Party ${opts.party} is not a signatory for ${contract.type}`,
      statusCode: 400,
    });
  }

  // Re-auth gate
  const user = await db.query.users.findFirst({ where: eq(users.id, opts.signerUserId) });
  if (!user) {
    throw new AppError({ code: 'UNAUTHORIZED', message: 'Signer not found', statusCode: 401 });
  }
  const ok = await argonVerify(user.passwordHash, opts.password);
  if (!ok) {
    throw new AppError({
      code: 'CONTRACT_REAUTH_FAILED',
      message: 'Password re-authentication failed',
      statusCode: 401,
    });
  }

  // Idempotency: a party can only sign once
  const already = await db
    .select()
    .from(contractSignatures)
    .where(
      and(
        eq(contractSignatures.contractId, opts.contractId),
        eq(contractSignatures.party, opts.party),
      ),
    )
    .limit(1);
  if (already[0]) {
    throw new AppError({
      code: 'CONTRACT_ALREADY_SIGNED',
      message: `Party ${opts.party} has already signed`,
      statusCode: 409,
    });
  }

  await db.insert(contractSignatures).values({
    contractId: opts.contractId,
    party: opts.party,
    signerUserId: opts.signerUserId,
    signerName: opts.typedName,
    ipAddress: opts.ipAddress ?? null,
    userAgent: opts.userAgent ?? null,
    method: opts.method ?? 'CHECKBOX_REAUTH',
  });

  events.emit('contract.signed', {
    contractId: opts.contractId,
    party: opts.party,
    signerUserId: opts.signerUserId,
  });

  // Recompute status after signing
  const all = await db
    .select()
    .from(contractSignatures)
    .where(eq(contractSignatures.contractId, opts.contractId));
  const signedParties = new Set(all.map((s) => s.party));
  const allSigned = expected.every((p) => signedParties.has(p));

  if (allSigned) {
    const [updated] = await db
      .update(contracts)
      .set({ status: 'FULLY_EXECUTED', fullyExecutedAt: new Date() })
      .where(eq(contracts.id, opts.contractId))
      .returning();
    if (!updated) {
      throw new AppError({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found', statusCode: 404 });
    }
    // If this contract supersedes another via an amendment chain, retire the original.
    const amendment = await db.query.contractAmendments.findFirst({
      where: eq(contractAmendments.supersedingContractId, updated.id),
    });
    if (amendment) {
      await db
        .update(contracts)
        .set({ status: 'SUPERSEDED', supersededById: updated.id })
        .where(eq(contracts.id, amendment.originalContractId));
    }
    events.emit('contract.fullyExecuted', {
      contractId: opts.contractId,
      placementId: updated.placementId,
    });
    return { contract: updated, fullyExecuted: true };
  }

  // Flip awaiting-status to the next outstanding party
  const nextParty = expected.find((p) => !signedParties.has(p));
  const nextStatus: ContractStatus = nextParty ? AWAITING_BY_PARTY[nextParty] : contract.status;
  const [updated] = await db
    .update(contracts)
    .set({ status: nextStatus })
    .where(eq(contracts.id, opts.contractId))
    .returning();
  if (!updated) {
    throw new AppError({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found', statusCode: 404 });
  }
  return { contract: updated, fullyExecuted: false };
}

export async function terminate(contractId: string, reason: string, actorId: string) {
  const contract = await db.query.contracts.findFirst({ where: eq(contracts.id, contractId) });
  if (!contract) {
    throw new AppError({
      code: 'CONTRACT_NOT_FOUND',
      message: 'Contract not found',
      statusCode: 404,
    });
  }
  const [row] = await db
    .update(contracts)
    .set({ status: 'TERMINATED', terminatedReason: reason })
    .where(eq(contracts.id, contractId))
    .returning();
  events.emit('contract.terminated', { contractId, reason });
  await recordAudit({
    actorId,
    action: 'contract.terminated',
    targetType: 'contract',
    targetId: contractId,
    metadata: { reason },
  });
  return row;
}

export async function listForUser(userId: string, role: string) {
  if (role === 'WORKER') {
    const worker = await db.query.workers.findFirst({ where: eq(workers.userId, userId) });
    if (!worker) return [];
    return db
      .select()
      .from(contracts)
      .where(eq(contracts.workerId, worker.id))
      .orderBy(desc(contracts.updatedAt));
  }
  if (role.startsWith('EMPLOYER')) {
    const employer = await db.query.employers.findFirst({ where: eq(employers.userId, userId) });
    if (!employer) return [];
    return db
      .select()
      .from(contracts)
      .where(eq(contracts.employerId, employer.id))
      .orderBy(desc(contracts.updatedAt));
  }
  return [];
}

export async function adminList(opts: { status?: string; type?: ContractType; page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit;
  const whereClauses = [];
  if (opts.status) whereClauses.push(eq(contracts.status, opts.status as ContractStatus));
  if (opts.type) whereClauses.push(eq(contracts.type, opts.type));
  const rows = await db
    .select()
    .from(contracts)
    .where(whereClauses.length ? and(...whereClauses) : undefined)
    .orderBy(desc(contracts.updatedAt))
    .limit(opts.limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contracts)
    .where(whereClauses.length ? and(...whereClauses) : undefined);
  return {
    data: rows,
    meta: { total: countRows[0]?.count ?? 0, page: opts.page, limit: opts.limit },
  };
}

/* --------------------------------- amendments ------------------------------- */

export interface AmendContractOpts {
  originalContractId: string;
  changedTerms: Record<string, string | number>;
  reason: string;
  initiatedBy: string;
  kind?: 'AMENDMENT' | 'RENEWAL';
  expiresAt?: string | null;
}

export async function amendContract(opts: AmendContractOpts) {
  const original = await db.query.contracts.findFirst({
    where: eq(contracts.id, opts.originalContractId),
  });
  if (!original) {
    throw new AppError({
      code: 'CONTRACT_NOT_FOUND',
      message: 'Contract not found',
      statusCode: 404,
    });
  }
  if (original.status !== 'FULLY_EXECUTED') {
    throw new AppError({
      code: 'CONTRACT_NOT_AMENDABLE',
      message: `Only FULLY_EXECUTED contracts can be amended (current: ${original.status}).`,
      statusCode: 409,
    });
  }

  // Diff the proposed terms against the existing rendered vars (best-effort).
  // We don't re-parse the body — we just record what the caller intended to change.
  const changedFields: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(opts.changedTerms)) {
    changedFields[k] = { from: null, to: v };
  }

  const draft = await createContract({
    type: original.type,
    templateId: original.templateId ?? undefined,
    placementId: original.placementId ?? undefined,
    employerId: original.employerId ?? undefined,
    workerId: original.workerId ?? undefined,
    expiresAt: opts.expiresAt ?? null,
    extraVars: opts.changedTerms as TemplateVars,
    createdBy: opts.initiatedBy,
  });

  const [amendmentRow] = await db
    .insert(contractAmendments)
    .values({
      originalContractId: original.id,
      supersedingContractId: draft.id,
      changedFields,
      reason: opts.reason,
      kind: opts.kind ?? 'AMENDMENT',
      initiatedBy: opts.initiatedBy,
    })
    .returning();

  await recordAudit({
    actorId: opts.initiatedBy,
    action: opts.kind === 'RENEWAL' ? 'contract.renewed' : 'contract.amended',
    targetType: 'contract',
    targetId: draft.id,
    metadata: {
      originalContractId: original.id,
      changedFields,
      reason: opts.reason,
    },
  });

  events.emit('contract.amended', {
    originalContractId: original.id,
    supersedingContractId: draft.id,
    changedFields,
  });

  return { amendment: amendmentRow, supersedingContract: draft };
}

export async function listAmendments(contractId: string) {
  const rows = await db
    .select()
    .from(contractAmendments)
    .where(eq(contractAmendments.originalContractId, contractId))
    .orderBy(desc(contractAmendments.createdAt));
  // Also include amendments where this contract is the *superseding* (so callers can walk back the chain)
  const inverse = await db
    .select()
    .from(contractAmendments)
    .where(eq(contractAmendments.supersedingContractId, contractId))
    .orderBy(desc(contractAmendments.createdAt));
  return { asOriginal: rows, asSuperseding: inverse };
}
