export type ChannelSendResult =
  | { status: 'SENT'; provider?: string; providerMessageId?: string }
  | { status: 'SKIPPED_CONFIG' }
  | { status: 'SKIPPED_NO_CONTACT' }
  | { status: 'FAILED'; errorMessage: string };
