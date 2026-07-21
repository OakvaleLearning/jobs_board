import type { MessageFlagReason } from '@oakvale/shared/enums/messaging.js';

const PHONE_PATTERNS: RegExp[] = [
  // International with +
  /\+\s*\d[\d\s().-]{6,}\d/g,
  // NG mobile prefixes (070,080,081,090,091,...) followed by 8 digits with separators
  /\b0(?:7|8|9)\d[\d\s().-]{6,12}\d/g,
  // Long runs of digits 7+
  /\b\d{7,}\b/g,
];

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const WHATSAPP_PATTERNS: RegExp[] = [
  /\bwa\.me\/\S+/gi,
  /\b(?:whats?\s*app|wa)\b[^\n]{0,40}\b(?:\+?\d|\d{6,})/gi,
];

const TELEGRAM_PATTERNS: RegExp[] = [/\bt\.me\/\S+/gi, /(?:^|\s)@[a-zA-Z0-9_]{4,}/g];

const SOCIAL_PATTERNS: RegExp[] = [
  /\b(?:instagram|ig|facebook|fb|twitter|x\.com|tiktok|snapchat)\b[^\n]{0,30}@?[A-Za-z0-9._]+/gi,
];

export interface LeakFilterResult {
  flagged: boolean;
  reasons: MessageFlagReason[];
  redacted: string;
}

export function checkContactLeaks(input: string): LeakFilterResult {
  const reasons = new Set<MessageFlagReason>();
  let redacted = input;

  for (const re of PHONE_PATTERNS) {
    if (re.test(redacted)) reasons.add('PHONE_NUMBER');
    redacted = redacted.replace(re, '[redacted phone]');
  }

  if (EMAIL_PATTERN.test(redacted)) reasons.add('EMAIL');
  redacted = redacted.replace(EMAIL_PATTERN, '[redacted email]');

  for (const re of WHATSAPP_PATTERNS) {
    if (re.test(redacted)) reasons.add('WHATSAPP_LINK');
    redacted = redacted.replace(re, '[redacted whatsapp]');
  }

  for (const re of TELEGRAM_PATTERNS) {
    if (re.test(redacted)) reasons.add('TELEGRAM_HANDLE');
    redacted = redacted.replace(re, '[redacted handle]');
  }

  for (const re of SOCIAL_PATTERNS) {
    if (re.test(redacted)) reasons.add('SOCIAL_LINK');
    redacted = redacted.replace(re, '[redacted social]');
  }

  return {
    flagged: reasons.size > 0,
    reasons: Array.from(reasons),
    redacted,
  };
}
