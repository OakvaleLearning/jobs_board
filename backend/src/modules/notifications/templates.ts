import { NOTIFICATION_KINDS, type NotificationKind } from '@oakvale/shared/enums/notifications.js';
import { AppError } from '@/shared/errors/app-error.js';

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
  sms: string;
}

export type TemplatePayload = Record<string, string | number | null | undefined>;

/**
 * A notification template = a per-kind variable context builder + the default copy.
 * The copy is stored with `{{token}}` placeholders so it can live in the DB and be edited
 * by admins. `buildContext` ports the per-kind derivation logic (slicing ids, date formatting,
 * fallbacks, pluralisation) and always returns display-ready values for every token.
 */
export interface KindTemplate {
  buildContext: (p: TemplatePayload) => Record<string, string>;
  defaults: RenderedTemplate;
}

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Lenient token fill — unknown/empty variables render as '' (notifications are best-effort copy). */
export function interpolate(str: string, vars: Record<string, string>): string {
  return str.replace(TOKEN_RE, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

/** Distinct `{{token}}` names across any number of template strings. */
export function extractVariables(...strings: string[]): string[] {
  const found = new Set<string>();
  for (const s of strings) {
    TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN_RE.exec(s)) !== null) {
      if (m[1] !== undefined) found.add(m[1]);
    }
  }
  return Array.from(found).sort();
}

/** Render all four channels of a template against a variable context. */
export function applyContext(tpl: RenderedTemplate, ctx: Record<string, string>): RenderedTemplate {
  return {
    subject: interpolate(tpl.subject, ctx),
    html: interpolate(tpl.html, ctx),
    text: interpolate(tpl.text, ctx),
    sms: interpolate(tpl.sms, ctx),
  };
}

function pickName(p: TemplatePayload, key: string, fallback: string): string {
  const v = p[key];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function p(text: string): string {
  return `<p>${text}</p>`;
}

const TEMPLATES: Record<NotificationKind, KindTemplate> = {
  identity_verified: {
    buildContext: (pl) => ({ name: pickName(pl, 'workerName', 'Hello') }),
    defaults: {
      subject: 'Your Oakvale identity is verified',
      text: '{{name}}, your identity documents have been approved. Add your Oakvale CPD certification to go live to employers.',
      html: p('{{name}}, your identity documents have been approved. Add your Oakvale CPD certification to go live to employers.'),
      sms: 'Oakvale: identity approved. Add your Oakvale CPD certification to go live.',
    },
  },
  profile_resubmitted: {
    buildContext: (pl) => ({ worker: pickName(pl, 'workerName', 'A verified worker') }),
    defaults: {
      subject: 'Verified worker updated their profile',
      text: '{{worker}} edited verified profile details and resubmitted for review. Check the changes before re-approving — re-approval re-runs the background check.',
      html: p('{{worker}} edited verified profile details and resubmitted for review. Check the changes before re-approving — re-approval re-runs the background check.'),
      sms: 'Oakvale: a verified worker resubmitted profile changes for review.',
    },
  },
  worker_shortlisted: {
    buildContext: () => ({}),
    defaults: {
      subject: 'You’ve been shortlisted',
      text: "Good news — an employer is reviewing your profile. You've been added to a shortlist; watch your placements page for next steps.",
      html: p("Good news — an employer is reviewing your profile. You've been added to a shortlist; watch your placements page for next steps."),
      sms: "Oakvale: you've been shortlisted by an employer. Check your placements page.",
    },
  },
  cpd_action_needed: {
    buildContext: () => ({}),
    defaults: {
      subject: 'Final step: add your Oakvale CPD certification',
      text: 'Your background check is clear. One step remains before employers can see you: add your Oakvale CPD certification (or enrol in the programme) from your compliance page.',
      html: p('Your background check is clear. One step remains before employers can see you: add your Oakvale CPD certification (or enrol in the programme) from your compliance page.'),
      sms: 'Oakvale: background check clear. Add your CPD certification to go live to employers.',
    },
  },
  background_check_attention: {
    buildContext: () => ({}),
    defaults: {
      subject: 'An update on your background documents',
      text: 'Our team reviewed the background documents you uploaded and flagged something that needs follow-up. Your Oakvale contact will be in touch about next steps — you can also re-upload clearer documents from your profile.',
      html: p('Our team reviewed the background documents you uploaded and flagged something that needs follow-up. Your Oakvale contact will be in touch about next steps — you can also re-upload clearer documents from your profile.'),
      sms: "Oakvale: your background documents need attention. We'll be in touch about next steps.",
    },
  },
  welfare_check_due: {
    buildContext: (pl) => ({ placement: pickName(pl, 'placementId', '').slice(0, 8) }),
    defaults: {
      subject: 'Welfare check due',
      text: 'A welfare check is due on placement {{placement}}. Please log it from your Oakvale dashboard.',
      html: p('A welfare check is due on placement {{placement}}. Please log it from your Oakvale dashboard.'),
      sms: 'Oakvale: welfare check due for placement {{placement}}.',
    },
  },
  cpd_expiry_warning: {
    buildContext: (pl) => ({ days: String(pl['daysRemaining'] ?? '60') }),
    defaults: {
      subject: 'Your CPD certification expires in {{days}} days',
      text: 'Heads up — your Oakvale CPD certification expires in {{days}} days. Renew before then to stay visible to employers.',
      html: p('Heads up — your Oakvale CPD certification expires in {{days}} days. Renew before then to stay visible to employers.'),
      sms: 'Oakvale: CPD cert expires in {{days}} days. Renew to stay visible.',
    },
  },
  replacement_sla_warning: {
    buildContext: (pl) => ({ hours: String(pl['hoursLeft'] ?? '24') }),
    defaults: {
      subject: 'Replacement SLA warning · {{hours}}h left',
      text: 'A replacement request is {{hours}}h from breaching its SLA. Open the admin board to fulfil it.',
      html: p('A replacement request is {{hours}}h from breaching its SLA. Open the admin board to fulfil it.'),
      sms: 'Oakvale: replacement SLA {{hours}}h left.',
    },
  },
  placement_activated: {
    buildContext: (pl) => ({ name: pickName(pl, 'workerName', 'Your worker') }),
    defaults: {
      subject: 'Placement activated',
      text: "Payment confirmed — {{name}}'s placement is now active. The 90-day replacement guarantee applies from today.",
      html: p("Payment confirmed — {{name}}'s placement is now active. The 90-day replacement guarantee applies from today."),
      sms: 'Oakvale: placement with {{name}} is now active.',
    },
  },
  placement_suspended: {
    buildContext: (pl) => ({ reason: pickName(pl, 'reason', 'safeguarding flag') }),
    defaults: {
      subject: 'Placement suspended',
      text: 'A placement has been suspended ({{reason}}). Your Oakvale agent will be in touch within one business day.',
      html: p('A placement has been suspended ({{reason}}). Your Oakvale agent will be in touch within one business day.'),
      sms: 'Oakvale: placement suspended ({{reason}}).',
    },
  },
  invoice_overdue_day1: {
    buildContext: (pl) => ({ inv: pickName(pl, 'invoiceId', '').slice(0, 8) }),
    defaults: {
      subject: 'Invoice {{inv}} is overdue',
      text: 'Your invoice {{inv}} is now past its due date. Settle it from the billing area to avoid service interruption.',
      html: p('Your invoice {{inv}} is now past its due date. Settle it from the billing area to avoid service interruption.'),
      sms: 'Oakvale: invoice {{inv}} overdue.',
    },
  },
  invoice_overdue_day7: {
    buildContext: (pl) => ({ inv: pickName(pl, 'invoiceId', '').slice(0, 8) }),
    defaults: {
      subject: 'Invoice {{inv}} · 7 days overdue',
      text: "Invoice {{inv}} is now a week past due. We've copied your HR primary contact. Please settle within the next 7 days to avoid escalation.",
      html: p("Invoice {{inv}} is now a week past due. We've copied your HR primary contact. Please settle within the next 7 days to avoid escalation."),
      sms: 'Oakvale: invoice {{inv}} 7d overdue.',
    },
  },
  invoice_overdue_day14_admin: {
    buildContext: (pl) => ({
      inv: pickName(pl, 'invoiceId', '').slice(0, 8),
      employer: pickName(pl, 'employerName', 'an employer'),
    }),
    defaults: {
      subject: 'Admin escalation · invoice {{inv}} 14 days overdue',
      text: 'Invoice {{inv}} ({{employer}}) has been past due for 14 days and has been flagged PAST_DUE. Time for collections to step in.',
      html: p('Invoice {{inv}} ({{employer}}) has been past due for 14 days and has been flagged PAST_DUE. Time for collections to step in.'),
      sms: 'Oakvale admin: invoice {{inv}} ({{employer}}) 14d overdue, now PAST_DUE.',
    },
  },
  payment_failed: {
    buildContext: (pl) => ({ inv: pickName(pl, 'invoiceId', '').slice(0, 8) }),
    defaults: {
      subject: 'Payment failed for invoice {{inv}}',
      text: 'Your most recent payment attempt for invoice {{inv}} failed. Update your card and retry from the billing area.',
      html: p('Your most recent payment attempt for invoice {{inv}} failed. Update your card and retry from the billing area.'),
      sms: 'Oakvale: payment failed for invoice {{inv}}.',
    },
  },
  welfare_report_monthly: {
    buildContext: (pl) => ({
      recipient: pickName(pl, 'careRecipientName', 'your loved one'),
      wellbeing: pickName(pl, 'recipientWellbeing', 'UNKNOWN'),
    }),
    defaults: {
      subject: 'Monthly welfare report — {{recipient}}',
      text: "This month's welfare report for {{recipient}} is attached as a PDF. Status: {{wellbeing}}. Your Oakvale account manager has logged the visit details inside.",
      html: p("This month's welfare report for {{recipient}} is attached as a PDF. Status: {{wellbeing}}. Your Oakvale account manager has logged the visit details inside."),
      sms: 'Oakvale: monthly welfare report for {{recipient}} ready in your inbox.',
    },
  },
  welfare_escalation_opened: {
    buildContext: (pl) => ({
      severity: pickName(pl, 'severity', 'flagged'),
      placement: pickName(pl, 'placementId', '').slice(0, 8),
    }),
    defaults: {
      subject: 'Welfare check {{severity}} on placement {{placement}}',
      text: 'A welfare check just came back {{severity}} on placement {{placement}}. You have 24 hours to action this from the admin dashboard.',
      html: p('A welfare check just came back {{severity}} on placement {{placement}}. You have 24 hours to action this from the admin dashboard.'),
      sms: 'Oakvale: welfare {{severity}} on placement {{placement}}. Action within 24h.',
    },
  },
  welfare_escalation_overdue: {
    buildContext: (pl) => ({ placement: pickName(pl, 'placementId', '').slice(0, 8) }),
    defaults: {
      subject: 'OVERDUE · welfare escalation on placement {{placement}}',
      text: 'A welfare escalation on placement {{placement}} was opened more than 24 hours ago and has not been resolved. Please action immediately.',
      html: p('A welfare escalation on placement {{placement}} was opened more than 24 hours ago and has not been resolved. Please action immediately.'),
      sms: 'Oakvale: welfare escalation on {{placement}} is OVERDUE.',
    },
  },
  contract_amended: {
    buildContext: (pl) => ({ contract: pickName(pl, 'contractId', '').slice(0, 8) }),
    defaults: {
      subject: 'Contract {{contract}} has been amended',
      text: 'A new version of contract {{contract}} has been drafted with revised terms. Open the contracts area to review and re-sign.',
      html: p('A new version of contract {{contract}} has been drafted with revised terms. Open the contracts area to review and re-sign.'),
      sms: 'Oakvale: contract {{contract}} amended. Please re-sign.',
    },
  },
  contract_renewal_due: {
    buildContext: (pl) => ({
      contract: pickName(pl, 'contractId', '').slice(0, 8),
      days: String(pl['daysUntilExpiry'] ?? '60'),
    }),
    defaults: {
      subject: 'Partnership {{contract}} renews in {{days}} days',
      text: 'Your annual partnership {{contract}} expires in {{days}} days. Your Oakvale account manager will reach out shortly to renew on agreed terms.',
      html: p('Your annual partnership {{contract}} expires in {{days}} days. Your Oakvale account manager will reach out shortly to renew on agreed terms.'),
      sms: 'Oakvale: partnership {{contract}} renews in {{days}}d.',
    },
  },
  partnership_lapsed: {
    buildContext: (pl) => ({
      contract: pickName(pl, 'contractId', '').slice(0, 8),
      employer: pickName(pl, 'employerName', 'an employer'),
    }),
    defaults: {
      subject: 'Partnership {{contract}} ({{employer}}) has lapsed',
      text: 'Annual partnership {{contract}} for {{employer}} expired more than 30 days ago without renewal. Their account is now flagged INACTIVE_AWAITING_RENEWAL.',
      html: p('Annual partnership {{contract}} for {{employer}} expired more than 30 days ago without renewal. Their account is now flagged INACTIVE_AWAITING_RENEWAL.'),
      sms: 'Oakvale admin: partnership {{contract}} ({{employer}}) lapsed.',
    },
  },
  saved_search_new_matches: {
    buildContext: (pl) => {
      const total = String(pl['totalNew'] ?? '0');
      return {
        name: pickName(pl, 'savedSearchName', 'your saved search'),
        total,
        workerPlural: total === '1' ? '' : 's',
        matchPlural: total === '1' ? '' : 'es',
      };
    },
    defaults: {
      subject: '{{total}} new worker{{workerPlural}} match "{{name}}"',
      text: '{{total}} newly-verified worker{{workerPlural}} matched "{{name}}". Open the workers page to review and shortlist.',
      html: p('{{total}} newly-verified worker{{workerPlural}} matched "{{name}}". Open the workers page to review and shortlist.'),
      sms: 'Oakvale: {{total}} new match{{matchPlural}} for "{{name}}".',
    },
  },
  subscription_cancelled: {
    buildContext: () => ({}),
    defaults: {
      subject: 'Your Oakvale subscription was cancelled',
      text: 'Your subscription has been cancelled and will lapse at the end of the current period.',
      html: p('Your subscription has been cancelled and will lapse at the end of the current period.'),
      sms: 'Oakvale: subscription cancelled.',
    },
  },
  job_post_approved: {
    buildContext: (pl) => ({ title: pickName(pl, 'jobTitle', 'Your job posting') }),
    defaults: {
      subject: 'Job posting approved — {{title}}',
      text: 'Good news — "{{title}}" passed Oakvale review and is now live for workers to apply.',
      html: p('Good news — "{{title}}" passed Oakvale review and is now live for workers to apply.'),
      sms: 'Oakvale: job posting "{{title}}" approved and now live.',
    },
  },
  job_post_revision_requested: {
    buildContext: (pl) => ({
      title: pickName(pl, 'jobTitle', 'Your job posting'),
      notes: pickName(pl, 'notes', 'Please review the requirements and resubmit.'),
    }),
    defaults: {
      subject: 'Revision requested — {{title}}',
      text: 'Our team reviewed "{{title}}" and asked for changes before it goes live: {{notes}}',
      html: p('Our team reviewed "{{title}}" and asked for changes before it goes live: {{notes}}'),
      sms: 'Oakvale: revision requested on job posting "{{title}}".',
    },
  },
  job_application_received: {
    buildContext: (pl) => ({
      title: pickName(pl, 'jobTitle', 'your job posting'),
      worker: pickName(pl, 'workerName', 'A verified worker'),
    }),
    defaults: {
      subject: 'New application — {{title}}',
      text: '{{worker}} has applied to "{{title}}". Review the applicant from your job posting\'s applicants list.',
      html: p('{{worker}} has applied to "{{title}}". Review the applicant from your job posting\'s applicants list.'),
      sms: 'Oakvale: new application for "{{title}}".',
    },
  },
  interview_requested: {
    buildContext: (pl) => ({ employer: pickName(pl, 'employerName', 'An employer') }),
    defaults: {
      subject: 'Interview requested',
      text: '{{employer}} would like to interview you. Open your interviews page to accept a time or propose an alternative.',
      html: p('{{employer}} would like to interview you. Open your interviews page to accept a time or propose an alternative.'),
      sms: 'Oakvale: {{employer}} requested an interview. Respond on your interviews page.',
    },
  },
  interview_confirmed: {
    buildContext: (pl) => {
      const slot = pickName(pl, 'slot', '');
      return { when: slot ? new Date(slot).toLocaleString() : 'the agreed time' };
    },
    defaults: {
      subject: 'Interview confirmed',
      text: "Your interview is confirmed for {{when}}. You'll find the details on your dashboard.",
      html: p("Your interview is confirmed for {{when}}. You'll find the details on your dashboard."),
      sms: 'Oakvale: interview confirmed for {{when}}.',
    },
  },
  employer_verification_pending: {
    buildContext: (pl) => ({ org: pickName(pl, 'orgName', 'An employer') }),
    defaults: {
      subject: 'Employer awaiting verification — {{org}}',
      text: '{{org}} has completed registration and is awaiting verification. Review their details and documents in the admin verification queue.',
      html: p('{{org}} has completed registration and is awaiting verification. Review their details and documents in the admin verification queue.'),
      sms: 'Oakvale: {{org}} awaiting employer verification.',
    },
  },
  employer_verification_approved: {
    buildContext: (pl) => ({ org: pickName(pl, 'orgName', 'Your organisation') }),
    defaults: {
      subject: 'Your Oakvale account is verified',
      text: '{{org}} has been verified. You can now search and shortlist verified workers and manage placements from your dashboard.',
      html: p('{{org}} has been verified. You can now search and shortlist verified workers and manage placements from your dashboard.'),
      sms: 'Oakvale: your account is verified — you can now hire.',
    },
  },
  employer_verification_rejected: {
    buildContext: (pl) => ({
      notes: pickName(pl, 'notes', 'Please review your details and documents and resubmit.'),
    }),
    defaults: {
      subject: 'Action needed on your Oakvale registration',
      text: "We couldn't verify your account yet: {{notes}} Your account manager will be in touch to help.",
      html: p("We couldn't verify your account yet: {{notes}} Your account manager will be in touch to help."),
      sms: 'Oakvale: action needed on your registration.',
    },
  },
  worker_job_match: {
    buildContext: (pl) => ({
      title: pickName(pl, 'jobTitle', 'A new role'),
      org: pickName(pl, 'orgName', 'An employer'),
    }),
    defaults: {
      subject: 'New role for you — {{title}}',
      text: '{{org}} posted "{{title}}", a role matched to your workforce category. Open the job from your dashboard to view details and apply.',
      html: p('{{org}} posted "{{title}}", a role matched to your workforce category. Open the job from your dashboard to view details and apply.'),
      sms: 'Oakvale: {{org}} posted "{{title}}" — a match for you. Open the app to apply.',
    },
  },
  rate_worker: {
    buildContext: (pl) => ({ worker: pickName(pl, 'workerName', 'your worker') }),
    defaults: {
      subject: 'How did {{worker}} do?',
      text: 'Your placement with {{worker}} has wrapped up. Leave a quick rating and review from your placements dashboard — it helps us match the best workers to future roles.',
      html: p('Your placement with {{worker}} has wrapped up. Leave a quick rating and review from your placements dashboard — it helps us match the best workers to future roles.'),
      sms: 'Oakvale: your placement ended — please rate your worker in the portal.',
    },
  },
  worker_payout_paid: {
    buildContext: (pl) => ({
      amount: pickName(pl, 'amount', 'your salary'),
      period: pickName(pl, 'period', 'this period'),
    }),
    defaults: {
      subject: 'Your Oakvale payout for {{period}}',
      text: 'Good news — your payout of {{amount}} for {{period}} has been paid. Reach out to your account manager if you have any questions.',
      html: p('Good news — your payout of {{amount}} for {{period}} has been paid. Reach out to your account manager if you have any questions.'),
      sms: 'Oakvale: your payout of {{amount}} for {{period}} has been paid.',
    },
  },
  email_verification: {
    buildContext: (pl) => ({
      name: pickName(pl, 'name', 'Hello'),
      link: String(pl.link ?? ''),
    }),
    defaults: {
      subject: 'Verify your Oakvale email',
      text: '{{name}}, welcome to Oakvale. Confirm your email address by opening this link: {{link}} — it expires in 24 hours.',
      html: p('{{name}}, welcome to Oakvale. Confirm your email address to activate your account.') +
        '<p><a href="{{link}}" style="display:inline-block;padding:12px 20px;background:#1a1a1a;color:#ffffff;border-radius:8px;text-decoration:none">Verify my email</a></p>' +
        p('Or paste this link into your browser: {{link}}') +
        p('This link expires in 24 hours. If you didn’t create an Oakvale account, you can ignore this email.'),
      sms: 'Oakvale: verify your email — {{link}} (expires in 24h).',
    },
  },
};

/** Code defaults per kind — seeds the DB and acts as the fallback when no active row exists. */
export const DEFAULT_TEMPLATES: Record<NotificationKind, RenderedTemplate> = Object.fromEntries(
  NOTIFICATION_KINDS.map((kind) => [kind, TEMPLATES[kind].defaults]),
) as Record<NotificationKind, RenderedTemplate>;

function templateFor(kind: NotificationKind): KindTemplate {
  const t = TEMPLATES[kind];
  if (!t) {
    throw new AppError({
      code: 'UNKNOWN_NOTIFICATION_KIND',
      message: `Unknown notification kind: ${kind}`,
      statusCode: 400,
    });
  }
  return t;
}

/** Build the display-ready variable context for a kind from its raw payload. */
export function buildContext(kind: NotificationKind, payload: TemplatePayload): Record<string, string> {
  return templateFor(kind).buildContext(payload);
}

/** Render a kind from its code defaults (used by tests and as the dispatch fallback). */
export function render(kind: NotificationKind, payload: TemplatePayload): RenderedTemplate {
  const t = templateFor(kind);
  return applyContext(t.defaults, t.buildContext(payload));
}
