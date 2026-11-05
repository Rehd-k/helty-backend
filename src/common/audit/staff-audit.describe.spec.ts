import { staffAuditAls } from './staff-audit.context';
import { buildLoginAudit, describeStaffWrite } from './staff-audit.describe';
import { persistStaffWrite } from './staff-audit.writer';

describe('staff audit descriptions', () => {
  it('redacts secrets and names the changed fields', () => {
    const described = describeStaffWrite({
      model: 'Staff',
      operation: 'update',
      args: {
        where: { id: 'staff-1' },
        data: { phone: '0803', password: 'plaintext', accessToken: 'abc' },
      },
      result: { id: 'staff-1' },
    });
    expect(described?.action).toBe('UPDATE');
    expect(described?.summary).toBe('UPDATE Staff · fields: phone');
    expect(described?.newValue).toMatchObject({
      phone: '0803',
      password: '[redacted]',
      accessToken: '[redacted]',
    });
    expect(described?.admissionId).toBeUndefined();
  });

  it('truncates oversized payloads', () => {
    const described = describeStaffWrite({
      model: 'NursingNote',
      operation: 'create',
      args: { data: { note: 'n'.repeat(9000), admissionId: 'adm-1' } },
      result: { id: 'note-1', admissionId: 'adm-1' },
    });
    expect(described?.newValue).toMatchObject({ truncated: true });
    expect(String(described?.newValue?.preview).length).toBeLessThanOrEqual(
      4000,
    );
  });

  it('maps a given medication dose on an admission to ADMINISTER', () => {
    const described = describeStaffWrite({
      model: 'MedicationAdministration',
      operation: 'create',
      args: {
        data: { admissionId: 'adm-1', status: 'GIVEN', remarks: 'taken' },
      },
      result: { id: 'dose-1', admissionId: 'adm-1', status: 'GIVEN' },
    });
    expect(described?.trailAction).toBe('ADMINISTER');
    expect(described?.admissionId).toBe('adm-1');
    expect(described?.entityId).toBe('dose-1');
  });

  it('reads an admission connect on create', () => {
    const described = describeStaffWrite({
      model: 'WardRoundNote',
      operation: 'create',
      args: {
        data: { note: 'stable', admission: { connect: { id: 'adm-9' } } },
      },
      result: { id: 'round-1' },
    });
    expect(described?.admissionId).toBe('adm-9');
    expect(described?.trailAction).toBe('CREATE');
  });

  it('does not point a deleted admission at a row that is already gone', () => {
    const described = describeStaffWrite({
      model: 'Admission',
      operation: 'delete',
      args: { where: { id: 'adm-1' } },
      result: { id: 'adm-1', patientId: 'patient-1' },
    });
    expect(described?.action).toBe('DELETE');
    expect(described?.entityId).toBe('adm-1');
    expect(described?.trailAction).toBeUndefined();
    expect(described?.oldValue).toMatchObject({ id: 'adm-1' });
  });

  it('does not build an admission trail for a batch write', () => {
    const described = describeStaffWrite({
      model: 'AlertLog',
      operation: 'deleteMany',
      args: { where: { admissionId: 'adm-1' } },
      result: { count: 3 },
    });
    expect(described?.entityId).toBe('batch:3');
    expect(described?.trailAction).toBeUndefined();
    expect(described?.action).toBe('DELETE');
  });

  it('keeps the password out of a failed login row', () => {
    const row = buildLoginAudit({
      success: false,
      identifier: 'ada@hospital.test',
      meta: { method: 'POST', route: '/auth/login', ip: '10.0.0.8' },
    });
    expect(row.action).toBe('LOGIN_FAILED');
    expect(row.newValue).toEqual({ identifier: 'ada@hospital.test' });
    expect(JSON.stringify(row)).not.toContain('password');
    expect(row.performedById).toBeUndefined();
  });

  it('writes both tables when a staff member changes an admission record', async () => {
    const auditLog = { create: jest.fn().mockResolvedValue({}) };
    const auditTrail = { create: jest.fn().mockResolvedValue({}) };
    await staffAuditAls.run({ staffId: 'staff-1', staffRole: 'NURSE' }, () =>
      persistStaffWrite(
        { auditLog, auditTrail },
        {
          model: 'NursingNote',
          operation: 'update',
          args: { where: { id: 'note-1' }, data: { note: 'reviewed' } },
          result: { id: 'note-1', admissionId: 'adm-1' },
        },
      ),
    );
    expect(auditLog.create).toHaveBeenCalledTimes(1);
    const trailCalls = auditTrail.create.mock.calls as unknown as Array<
      [{ data: { actionType: string; admission: { connect: { id: string } } } }]
    >;
    expect(trailCalls[0][0].data.actionType).toBe('UPDATE');
    expect(trailCalls[0][0].data.admission).toEqual({
      connect: { id: 'adm-1' },
    });
  });

  it('ignores writes that have no staff member on the request', async () => {
    const auditLog = { create: jest.fn() };
    const auditTrail = { create: jest.fn() };
    await persistStaffWrite(
      { auditLog, auditTrail },
      {
        model: 'Patient',
        operation: 'create',
        args: { data: { firstName: 'Ada' } },
        result: { id: 'patient-1' },
      },
    );
    expect(auditLog.create).not.toHaveBeenCalled();
    expect(auditTrail.create).not.toHaveBeenCalled();
  });
});
