import {
  createAntenatalEncounterForPregnancy,
  isTerminalPregnancyStatus,
} from './pregnancy-encounter.util';
import { EncounterStatus, PregnancyStatus } from '@prisma/client';

describe('pregnancy-encounter.util', () => {
  it('isTerminalPregnancyStatus identifies terminal states', () => {
    expect(isTerminalPregnancyStatus(PregnancyStatus.DELIVERED)).toBe(true);
    expect(isTerminalPregnancyStatus(PregnancyStatus.ONGOING)).toBe(false);
  });

  it('createAntenatalEncounterForPregnancy sets antenatal visit type', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'enc-1' });
    const tx = { encounter: { create } } as any;

    await createAntenatalEncounterForPregnancy(tx, {
      patientId: 'pat-1',
      doctorId: 'doc-1',
      createdById: 'doc-1',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'pat-1',
          visitType: 'Antenatal',
          status: EncounterStatus.ONGOING,
        }),
      }),
    );
  });
});
