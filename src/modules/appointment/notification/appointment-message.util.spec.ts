import {
  buildAppointmentMessages,
  buildIdempotencyKey,
  getLagosDateBucket,
  getLagosDayBounds,
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
});
