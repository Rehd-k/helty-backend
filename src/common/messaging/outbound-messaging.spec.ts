import { isOutboundMessagingEnabled } from './outbound-messaging';

describe('isOutboundMessagingEnabled', () => {
  it('stays on when unset, blank, or true', () => {
    expect(isOutboundMessagingEnabled(undefined)).toBe(true);
    expect(isOutboundMessagingEnabled(null)).toBe(true);
    expect(isOutboundMessagingEnabled('')).toBe(true);
    expect(isOutboundMessagingEnabled('true')).toBe(true);
    expect(isOutboundMessagingEnabled(true)).toBe(true);
  });

  it('turns off for false, 0, off, and no', () => {
    expect(isOutboundMessagingEnabled('false')).toBe(false);
    expect(isOutboundMessagingEnabled('FALSE')).toBe(false);
    expect(isOutboundMessagingEnabled('0')).toBe(false);
    expect(isOutboundMessagingEnabled('off')).toBe(false);
    expect(isOutboundMessagingEnabled('no')).toBe(false);
    expect(isOutboundMessagingEnabled(false)).toBe(false);
  });
});
