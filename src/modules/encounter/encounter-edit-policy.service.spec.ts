import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EncounterStatus } from '@prisma/client';
import { EncounterEditPolicyService } from './encounter-edit-policy.service';
import { ClinicalSnapshot } from './encounter-clinical-snapshot.types';

describe('EncounterEditPolicyService', () => {
  const encounterId = 'enc-1';
  const doctorId = 'doc-1';
  const otherStaffId = 'staff-2';

  const emptySnapshot = (): ClinicalSnapshot => ({
    encounter: {
      chiefComplaint: null,
      hpi: 'old hpi',
      pmh: null,
      surgicalHistory: null,
      drugHistory: null,
      allergyHistory: null,
      familyHistory: null,
      socialHistory: null,
      examinationNotes: null,
      soapSubjective: null,
      soapObjective: null,
      soapAssessment: null,
      soapPlan: null,
      triageNotes: null,
      proceduresJson: null,
    },
    diagnoses: [],
    specialtyModules: [],
    clinicalSections: [],
  });

  let prisma: {
    encounter: { findUnique: jest.Mock };
    encounterDiagnosis: { findMany: jest.Mock };
    encounterSpecialtyModule: { findMany: jest.Mock };
    encounterClinicalSection: { findMany: jest.Mock };
    encounterEditHistory: {
      create: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let service: EncounterEditPolicyService;

  beforeEach(() => {
    prisma = {
      encounter: { findUnique: jest.fn() },
      encounterDiagnosis: { findMany: jest.fn().mockResolvedValue([]) },
      encounterSpecialtyModule: { findMany: jest.fn().mockResolvedValue([]) },
      encounterClinicalSection: { findMany: jest.fn().mockResolvedValue([]) },
      encounterEditHistory: {
        create: jest.fn().mockResolvedValue({ id: 'hist-1' }),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    service = new EncounterEditPolicyService(prisma as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('assertCanEdit', () => {
    it('rejects non-treating doctor', async () => {
      prisma.encounter.findUnique.mockResolvedValue({
        id: encounterId,
        status: EncounterStatus.ONGOING,
        doctorId,
      });
      await expect(
        service.assertCanEdit(encounterId, otherStaffId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects cancelled encounters', async () => {
      prisma.encounter.findUnique.mockResolvedValue({
        id: encounterId,
        status: EncounterStatus.CANCELLED,
        doctorId,
      });
      await expect(service.assertCanEdit(encounterId, doctorId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows treating doctor on ongoing encounter', async () => {
      prisma.encounter.findUnique.mockResolvedValue({
        id: encounterId,
        status: EncounterStatus.ONGOING,
        doctorId,
      });
      const access = await service.assertCanEdit(encounterId, doctorId);
      expect(access.status).toBe(EncounterStatus.ONGOING);
    });
  });

  describe('recordEditIfCompleted', () => {
    it('does not write history for ongoing encounters', async () => {
      await service.recordEditIfCompleted(
        {
          id: encounterId,
          status: EncounterStatus.ONGOING,
          doctorId,
        },
        doctorId,
        emptySnapshot(),
        ['hpi'],
      );
      expect(prisma.encounterEditHistory.create).not.toHaveBeenCalled();
    });

    it('writes history for completed encounters when keys changed', async () => {
      const snapshot = emptySnapshot();
      await service.recordEditIfCompleted(
        {
          id: encounterId,
          status: EncounterStatus.COMPLETED,
          doctorId,
        },
        doctorId,
        snapshot,
        ['hpi'],
        'Corrected typo',
      );
      expect(prisma.encounterEditHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            encounterId,
            editedById: doctorId,
            reason: 'Corrected typo',
            changedKeys: ['hpi'],
          }),
        }),
      );
    });

    it('skips history when changedKeys is empty', async () => {
      await service.recordEditIfCompleted(
        {
          id: encounterId,
          status: EncounterStatus.COMPLETED,
          doctorId,
        },
        doctorId,
        emptySnapshot(),
        [],
      );
      expect(prisma.encounterEditHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('computeEncounterFieldChanges', () => {
    it('detects changed encounter fields from patch', () => {
      const before = emptySnapshot();
      const keys = service.computeEncounterFieldChanges(before, {
        hpi: 'new hpi',
        chiefComplaint: undefined,
      });
      expect(keys).toEqual(['hpi']);
    });

    it('returns empty when patch values match current', () => {
      const before = emptySnapshot();
      const keys = service.computeEncounterFieldChanges(before, {
        hpi: 'old hpi',
      });
      expect(keys).toEqual([]);
    });
  });

  describe('getEditMeta', () => {
    it('reports canEdit for treating doctor', async () => {
      prisma.encounter.findUnique.mockResolvedValue({
        id: encounterId,
        status: EncounterStatus.COMPLETED,
        doctorId,
      });
      prisma.encounterEditHistory.count.mockResolvedValue(2);
      prisma.encounterEditHistory.findFirst.mockResolvedValue({
        editedAt: new Date('2026-05-28T12:00:00.000Z'),
      });

      const meta = await service.getEditMeta(encounterId, doctorId);
      expect(meta).toEqual({
        hasEdits: true,
        editCount: 2,
        lastEditedAt: '2026-05-28T12:00:00.000Z',
        canEdit: true,
        requiresVersionedEdits: true,
      });
    });

    it('reports canEdit false for other staff', async () => {
      prisma.encounter.findUnique.mockResolvedValue({
        id: encounterId,
        status: EncounterStatus.ONGOING,
        doctorId,
      });
      const meta = await service.getEditMeta(encounterId, otherStaffId);
      expect(meta.canEdit).toBe(false);
      expect(meta.requiresVersionedEdits).toBe(false);
    });
  });

  describe('loadEncounterAccess', () => {
    it('throws when encounter missing', async () => {
      prisma.encounter.findUnique.mockResolvedValue(null);
      await expect(service.loadEncounterAccess('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
