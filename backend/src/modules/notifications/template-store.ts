import { eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { notificationTemplates, type NotificationTemplate } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { recordAudit } from '@/shared/audit/record.js';
import { logger } from '@/shared/logger/logger.js';
import {
  NOTIFICATION_KINDS,
  NOTIFICATION_TEMPLATE_META,
  type NotificationKind,
} from '@oakvale/shared/enums/notifications.js';
import type { NotificationTemplateUpdateInput } from '@oakvale/shared/schema/notifications.js';
import {
  applyContext,
  buildContext,
  DEFAULT_TEMPLATES,
  extractVariables,
  type RenderedTemplate,
  type TemplatePayload,
} from './templates.js';

function isKnownKind(kind: string): kind is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(kind);
}

function assertKind(kind: string): NotificationKind {
  if (!isKnownKind(kind)) {
    throw new AppError({
      code: 'UNKNOWN_NOTIFICATION_KIND',
      message: `Unknown notification kind: ${kind}`,
      statusCode: 404,
    });
  }
  return kind;
}

/* ------------------------------ render cache ------------------------------ */
// Small in-process cache of the resolved (active) template per kind. Busted on update so an
// admin's edit takes effect on the next dispatch without restarting the worker.
const cache = new Map<NotificationKind, RenderedTemplate>();

function bodyOf(row: NotificationTemplate): RenderedTemplate {
  return { subject: row.subject, html: row.html, text: row.text, sms: row.sms };
}

function isModified(row: NotificationTemplate): boolean {
  const def = DEFAULT_TEMPLATES[row.kind as NotificationKind];
  if (!def) return true;
  return (
    row.subject !== def.subject ||
    row.html !== def.html ||
    row.text !== def.text ||
    row.sms !== def.sms ||
    !row.isActive
  );
}

/* ------------------------------- seeding ---------------------------------- */
/** Insert the code defaults for any kind that has no row yet. Never overwrites admin edits. */
export async function seedDefaults(): Promise<void> {
  try {
    for (const kind of NOTIFICATION_KINDS) {
      const def = DEFAULT_TEMPLATES[kind];
      await db
        .insert(notificationTemplates)
        .values({
          kind,
          subject: def.subject,
          html: def.html,
          text: def.text,
          sms: def.sms,
          variables: extractVariables(def.subject, def.text, def.html, def.sms),
        })
        .onConflictDoNothing({ target: notificationTemplates.kind });
    }
  } catch (err) {
    logger.warn({ err }, 'notification-template seedDefaults failed');
  }
}

/* --------------------------------- reads ---------------------------------- */
export async function listTemplates(): Promise<(NotificationTemplate & { label: string; isModified: boolean })[]> {
  const rows = await db.select().from(notificationTemplates);
  const byKind = new Map(rows.map((r) => [r.kind, r]));
  // Return one entry per known kind (defaults stand in for any not-yet-seeded kind).
  return NOTIFICATION_KINDS.map((kind) => {
    const row = byKind.get(kind);
    const def = DEFAULT_TEMPLATES[kind];
    const base: NotificationTemplate =
      row ??
      ({
        id: kind,
        kind,
        subject: def.subject,
        html: def.html,
        text: def.text,
        sms: def.sms,
        variables: extractVariables(def.subject, def.text, def.html, def.sms),
        isActive: true,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as NotificationTemplate);
    return {
      ...base,
      label: NOTIFICATION_TEMPLATE_META[kind].label,
      isModified: row ? isModified(row) : false,
    };
  });
}

export async function getTemplate(kind: string): Promise<{
  kind: NotificationKind;
  label: string;
  variables: { name: string; sample: string }[];
  template: RenderedTemplate & { isActive: boolean };
  default: RenderedTemplate;
}> {
  const k = assertKind(kind);
  const row = await db.query.notificationTemplates.findFirst({
    where: eq(notificationTemplates.kind, k),
  });
  const tpl = row ? { ...bodyOf(row), isActive: row.isActive } : { ...DEFAULT_TEMPLATES[k], isActive: true };
  return {
    kind: k,
    label: NOTIFICATION_TEMPLATE_META[k].label,
    variables: NOTIFICATION_TEMPLATE_META[k].variables,
    template: tpl,
    default: DEFAULT_TEMPLATES[k],
  };
}

/* -------------------------------- updates --------------------------------- */
export async function updateTemplate(
  kind: string,
  input: NotificationTemplateUpdateInput,
  actorId: string,
): Promise<NotificationTemplate> {
  const k = assertKind(kind);
  const variables = extractVariables(input.subject, input.text, input.html, input.sms);
  const [row] = await db
    .insert(notificationTemplates)
    .values({
      kind: k,
      subject: input.subject,
      html: input.html,
      text: input.text,
      sms: input.sms,
      variables,
      isActive: input.isActive ?? true,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: notificationTemplates.kind,
      set: {
        subject: input.subject,
        html: input.html,
        text: input.text,
        sms: input.sms,
        variables,
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedBy: actorId,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to save template.', statusCode: 500 });
  }
  cache.delete(k);
  await recordAudit({
    actorId,
    action: 'notification_template.updated',
    targetType: 'notification_template',
    targetId: k,
    metadata: { variables },
  });
  return row;
}

/* ---------------------------- dispatch + preview -------------------------- */
/** The active template for a kind, falling back to code defaults when no active row exists. */
async function resolveTemplate(kind: NotificationKind): Promise<RenderedTemplate> {
  const cached = cache.get(kind);
  if (cached) return cached;
  const row = await db.query.notificationTemplates.findFirst({
    where: eq(notificationTemplates.kind, kind),
  });
  const tpl = row && row.isActive ? bodyOf(row) : DEFAULT_TEMPLATES[kind];
  cache.set(kind, tpl);
  return tpl;
}

/** Render a notification for dispatch: DB template (source of truth) + derived payload context. */
export async function renderForDispatch(
  kind: NotificationKind,
  payload: TemplatePayload,
): Promise<RenderedTemplate> {
  const tpl = await resolveTemplate(kind);
  return applyContext(tpl, buildContext(kind, payload));
}

/** Render a (draft or stored) template against the kind's sample variables — no DB write. */
export function previewTemplate(kind: string, draft: RenderedTemplate): RenderedTemplate {
  const k = assertKind(kind);
  const ctx: Record<string, string> = {};
  for (const v of NOTIFICATION_TEMPLATE_META[k].variables) ctx[v.name] = v.sample;
  return applyContext(draft, ctx);
}
