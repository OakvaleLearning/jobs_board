export const CONVERSATION_STATUSES = ['OPEN', 'LOCKED'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const MESSAGE_FLAG_REASONS = [
  'PHONE_NUMBER',
  'EMAIL',
  'WHATSAPP_LINK',
  'TELEGRAM_HANDLE',
  'SOCIAL_LINK',
] as const;
export type MessageFlagReason = (typeof MESSAGE_FLAG_REASONS)[number];
