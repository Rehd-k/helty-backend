import { AdmissionStatus } from '@prisma/client';
import { getPatientAdmissionContext } from './patient-admission-context.util';

describe('getPatientAdmissionContext', () => {
  it('returns nulls when no open admission exists', async () => {
    const prisma = {
      admission: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    await expect(
      getPatientAdmissionContext(prisma as any, 'pat-1'),
    ).resolves.toEqual({ admissionId: null, wardId: null });

    expect(prisma.admission.findFirst).toHaveBeenCalledWith({
      where: {
        patientId: 'pat-1',
        status: {
          in: [
            AdmissionStatus.ACTIVE,
            AdmissionStatus.PENDING_BILLING_CLEARANCE,
          ],
        },
      },
      orderBy: { admissionDateTime: 'desc' },
      select: { id: true, wardId: true },
    });
  });

  it('returns admissionId and wardId from the latest open admission', async () => {
    const prisma = {
      admission: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'adm-1',
          wardId: 'ward-1',
        }),
      },
    };

    await expect(
      getPatientAdmissionContext(prisma as any, 'pat-1'),
    ).resolves.toEqual({ admissionId: 'adm-1', wardId: 'ward-1' });
  });
});
