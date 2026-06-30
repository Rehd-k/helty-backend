import { NotFoundException } from '@nestjs/common';
import {
  EncounterStatus,
  EncounterType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { PatientMedicalRecordsService } from './patient-medical-records.service';

describe('PatientMedicalRecordsService', () => {
  const prisma = {
    encounter: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  const service = new PatientMedicalRecordsService(prisma);

  const patientUser: PatientJwtPayload = {
    sub: 'patient-uuid-1',
    patientId: 'AB12CD34',
    accountType: 'PATIENT',
  };

  const listEncounter = {
    id: 'encounter-1',
    encounterType: EncounterType.OUTPATIENT,
    status: EncounterStatus.COMPLETED,
    startTime: new Date('2025-06-01T10:00:00.000Z'),
    endTime: new Date('2025-06-01T11:00:00.000Z'),
    chiefComplaint: 'Headache',
    visitType: 'OPD',
    primaryIcdDescription: 'Tension headache',
    doctor: { firstName: 'Jane', lastName: 'Smith' },
    diagnoses: [{ primaryIcdDescription: 'Tension headache' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only the authenticated patient encounters with pagination', async () => {
    prisma.encounter.findMany = jest.fn().mockResolvedValue([listEncounter]);
    prisma.encounter.count = jest.fn().mockResolvedValue(1);

    const result = await service.listMedicalRecords(patientUser, {
      page: 2,
      limit: 10,
    });

    expect(prisma.encounter.findMany).toHaveBeenCalledWith({
      where: { patientId: 'patient-uuid-1' },
      skip: 10,
      take: 10,
      orderBy: { startTime: 'desc' },
      include: expect.any(Object),
    });
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: 'encounter-1',
          doctorName: 'Jane Smith',
          primaryDiagnosis: 'Tension headache',
        }),
      ],
      total: 1,
      page: 2,
      limit: 10,
    });
  });

  it('returns encounter detail for the authenticated patient', async () => {
    prisma.encounter.findFirst = jest.fn().mockResolvedValue({
      ...listEncounter,
      primaryIcdCode: 'R51',
      followUpDate: '2025-07-01',
      followUpInstructions: 'Return if symptoms persist',
      referral: null,
      soapSubjective: 'Patient reports headache',
      soapObjective: 'BP normal',
      soapAssessment: 'Tension headache',
      soapPlan: 'Rest and fluids',
      diagnoses: [
        {
          primaryIcdCode: 'R51',
          primaryIcdDescription: 'Tension headache',
          secondaryDiagnosesJson: null,
        },
      ],
      patientVitals: [
        {
          systolic: 120,
          diastolic: 80,
          temperature: 36.8,
          height: 170,
          weight: 70,
          bmi: 24.2,
          pulseRate: 72,
          respRate: 18,
          spo2: 98,
          painScore: 2,
          bloodGlucose: null,
          recordedAt: new Date('2025-06-01T10:05:00.000Z'),
        },
      ],
      prescriptions: [
        {
          id: 'rx-1',
          drug: 'Paracetamol',
          dosage: '500mg',
          notes: null,
          startDate: new Date('2025-06-01T10:30:00.000Z'),
          endDate: null,
          items: [
            {
              dosage: '500mg',
              frequency: 'TDS',
              duration: 5,
              instructions: 'After meals',
              drug: { brandName: 'Panadol', genericName: 'Paracetamol' },
              consumable: null,
            },
          ],
        },
      ],
    });

    const result = await service.getEncounter(patientUser, 'encounter-1');

    expect(prisma.encounter.findFirst).toHaveBeenCalledWith({
      where: { id: 'encounter-1', patientId: 'patient-uuid-1' },
      include: expect.any(Object),
    });
    expect(result.id).toBe('encounter-1');
    expect(result.vitals?.systolic).toBe(120);
    expect(result.prescriptions).toHaveLength(1);
    expect(result.soap?.assessment).toBe('Tension headache');
  });

  it('throws NotFoundException when encounter belongs to another patient', async () => {
    prisma.encounter.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      service.getEncounter(patientUser, 'other-encounter'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
