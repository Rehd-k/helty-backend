import {
  buildAppointmentMessages,
  buildIdempotencyKey,
  getLagosDateBucket,
  getLagosDayBounds,
  getLagosDayBoundsOffset,
  isCancelledStatus,
  isReminderEligibleStatus,
} from './appointment-message.util';

describe('appointment-message.util', () => {
  it('builds created appointment messages', () => {
    const messages = buildAppointmentMessages({
      kind: 'CREATED',
      patientName: 'Jane Doe',
      appointmentDate: new Date('2026-05-27T09:00:00.000Z'),
      hospitalName: 'Helty Hospital',
    });

    expect(messages.subject).toContain('Appointment confirmed');
    expect(messages.text).toContain('Jane Doe');
    expect(messages.sms).toContain('Helty Hospital');
  });

  it('builds idempotency keys for day-of reminders', () => {
    expect(
      buildIdempotencyKey({
        appointmentId: 'appt-1',
        kind: 'REMINDER_DAY_OF',
        channel: 'SMS',
        dateBucket: '2026-05-27',
      }),
    ).toBe('appt-1:REMINDER_DAY_OF:SMS:2026-05-27');
  });

  it('builds day-before messages and PUSH idempotency keys', () => {
    const messages = buildAppointmentMessages({
      kind: 'REMINDER_DAY_BEFORE',
      patientName: 'Jane Doe',
      appointmentDate: new Date('2026-05-28T09:00:00.000Z'),
      hospitalName: 'Helty Hospital',
    });
    expect(messages.subject).toContain('tomorrow');
    expect(messages.pushTitle).toContain('tomorrow');
    expect(
      buildIdempotencyKey({
        appointmentId: 'appt-1',
        kind: 'REMINDER_DAY_BEFORE',
        channel: 'PUSH',
        dateBucket: '2026-05-28',
      }),
    ).toBe('appt-1:REMINDER_DAY_BEFORE:PUSH:2026-05-28');
  });

  it('detects cancelled and reminder-eligible statuses', () => {
    expect(isCancelledStatus('cancelled')).toBe(true);
    expect(isCancelledStatus('CANCELLED')).toBe(true);
    expect(isReminderEligibleStatus('scheduled')).toBe(true);
    expect(isReminderEligibleStatus('rescheduled')).toBe(true);
    expect(isReminderEligibleStatus('cancelled')).toBe(false);
  });

  it('computes Lagos day bucket and bounds', () => {
    const reference = new Date('2026-05-27T04:00:00.000Z');
    const bucket = getLagosDateBucket(reference);
    expect(bucket).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const { from, to } = getLagosDayBounds(reference);
    expect(from.getTime()).toBeLessThan(to.getTime());
  });

  it('computes Lagos tomorrow bounds via offset', () => {
    const reference = new Date('2026-05-27T04:00:00.000Z');
    const today = getLagosDateBucket(reference);
    const tomorrow = getLagosDayBoundsOffset(reference, 1);
    expect(tomorrow.dateBucket).not.toBe(today);
    expect(tomorrow.from.getTime()).toBeLessThan(tomorrow.to.getTime());
  });
});
