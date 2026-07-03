import { NotFoundException } from '@nestjs/common';
import { EncounterStatus, EncounterType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { PatientMedicalRecordsService } from './patient-medical-records.service';

describe('PatientMedicalRecordsService', () => {
  const prisma = {
    pregnancy: {
      findFirst: jest.fn(),
    },
    patientVitals: {
      findFirst: jest.fn(),
    },
    patientAllergy: {
      findMany: jest.fn(),
    },
    encounterDiagnosis: {
      findMany: jest.fn(),
    },
    labResult: {
      findMany: jest.fn(),
    },
    encounter: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const service = new PatientMedicalRecordsService(
    prisma as unknown as PrismaService,
  );

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

  const homeVitalsNormal = {
    pulseRate: 72,
    systolic: 118,
    diastolic: 78,
    recordedAt: new Date('2026-06-15T09:30:00.000Z'),
  };

  function mockDashboardVitals(options: {
    heightWeight?: { height: number; weight: number } | null;
    encounterVitals?: typeof homeVitalsNormal | null;
    fallbackVitals?: typeof homeVitalsNormal | null;
  }) {
    prisma.patientVitals.findFirst = jest.fn().mockImplementation((args) => {
      if (args.select?.height !== undefined) {
        return Promise.resolve(options.heightWeight ?? null);
      }
      if (args.where?.encounterId) {
        return Promise.resolve(options.encounterVitals ?? null);
      }
      return Promise.resolve(options.fallbackVitals ?? null);
    });
  }

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

    expect(prisma.encounter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { patientId: 'patient-uuid-1' },
        skip: 10,
        take: 10,
        orderBy: { startTime: 'desc' },
      }),
    );
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

    expect(prisma.encounter.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'encounter-1', patientId: 'patient-uuid-1' },
      }),
    );
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

  it('returns dashboard payload with mapped records', async () => {
    prisma.pregnancy.findFirst = jest
      .fn()
      .mockResolvedValue({ bloodGroup: 'O+' });
    mockDashboardVitals({
      heightWeight: { height: 182, weight: 78 },
      encounterVitals: homeVitalsNormal,
    });
    prisma.patientAllergy.findMany = jest
      .fn()
      .mockResolvedValue([{ allergen: 'Penicillin', severity: 'CRITICAL' }]);
    prisma.encounterDiagnosis.findMany = jest.fn().mockResolvedValue([
      {
        id: 'diag_1',
        primaryIcdDescription: 'Hypertension (Stage 1)',
        createdAt: new Date('2021-02-11T10:00:00.000Z'),
        encounter: {
          status: EncounterStatus.COMPLETED,
          doctor: {
            firstName: 'Amadi',
            lastName: '',
            department: { name: 'General Medicine' },
          },
        },
      },
    ]);
    prisma.labResult.findMany = jest.fn().mockResolvedValue([
      {
        value: '5.4%',
        abnormalFlag: 'NORMAL',
        createdAt: new Date('2022-08-14T00:00:00.000Z'),
        field: {
          label: 'Hemoglobin A1c',
          referenceRange: '< 5.7%',
        },
      },
    ]);

    const result = await service.getDashboard(patientUser);

    expect(prisma.encounterDiagnosis.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
      }),
    );
    expect(prisma.labResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
      }),
    );
    expect(result).toEqual({
      bloodType: 'O+',
      heightCm: 182,
      weightKg: 78,
      latestVitals: {
        pulseRate: 72,
        systolic: 118,
        diastolic: 78,
        recordedAt: new Date('2026-06-15T09:30:00.000Z'),
        bloodPressureStatus: 'Normal',
      },
      allergies: [{ name: 'Penicillin', severity: 'CRITICAL' }],
      recentDiagnoses: [
        {
          id: 'diag_1',
          title: 'Hypertension (Stage 1)',
          doctorName: 'Amadi',
          specialty: 'General Medicine',
          status: EncounterStatus.COMPLETED,
          diagnosedAt: new Date('2021-02-11T10:00:00.000Z'),
        },
      ],
      immunizations: [],
      recentLabResults: [
        {
          testName: 'Hemoglobin A1c',
          result: '5.4%',
          referenceRange: '< 5.7%',
          status: 'NORMAL',
        },
      ],
    });
  });

  it('returns nulls and empty arrays for dashboard when data is missing', async () => {
    prisma.pregnancy.findFirst = jest.fn().mockResolvedValue(null);
    mockDashboardVitals({});
    prisma.patientAllergy.findMany = jest.fn().mockResolvedValue([]);
    prisma.encounterDiagnosis.findMany = jest.fn().mockResolvedValue([]);
    prisma.labResult.findMany = jest.fn().mockResolvedValue([]);

    const result = await service.getDashboard(patientUser);

    expect(result).toEqual({
      bloodType: null,
      heightCm: null,
      weightKg: null,
      latestVitals: null,
      allergies: [],
      recentDiagnoses: [],
      immunizations: [],
      recentLabResults: [],
    });
  });

  it('falls back to non-encounter vitals when encounter vitals are absent', async () => {
    prisma.pregnancy.findFirst = jest.fn().mockResolvedValue(null);
    mockDashboardVitals({
      encounterVitals: null,
      fallbackVitals: homeVitalsNormal,
    });
    prisma.patientAllergy.findMany = jest.fn().mockResolvedValue([]);
    prisma.encounterDiagnosis.findMany = jest.fn().mockResolvedValue([]);
    prisma.labResult.findMany = jest.fn().mockResolvedValue([]);

    const result = await service.getDashboard(patientUser);

    expect(result.latestVitals).toEqual({
      pulseRate: 72,
      systolic: 118,
      diastolic: 78,
      recordedAt: new Date('2026-06-15T09:30:00.000Z'),
      bloodPressureStatus: 'Normal',
    });
    expect(prisma.patientVitals.findFirst).toHaveBeenCalledTimes(3);
  });

  it('computes Elevated and High blood pressure status labels', async () => {
    prisma.pregnancy.findFirst = jest.fn().mockResolvedValue(null);
    prisma.patientAllergy.findMany = jest.fn().mockResolvedValue([]);
    prisma.encounterDiagnosis.findMany = jest.fn().mockResolvedValue([]);
    prisma.labResult.findMany = jest.fn().mockResolvedValue([]);

    mockDashboardVitals({
      encounterVitals: {
        pulseRate: 70,
        systolic: 125,
        diastolic: 75,
        recordedAt: new Date('2026-06-15T09:30:00.000Z'),
      },
    });
    const elevated = await service.getDashboard(patientUser);
    expect(elevated.latestVitals?.bloodPressureStatus).toBe('Elevated');

    mockDashboardVitals({
      encounterVitals: {
        pulseRate: 80,
        systolic: 140,
        diastolic: 90,
        recordedAt: new Date('2026-06-16T09:30:00.000Z'),
      },
    });
    const high = await service.getDashboard(patientUser);
    expect(high.latestVitals?.bloodPressureStatus).toBe('High');
  });

  it('returns null bloodPressureStatus when only one BP value is recorded', async () => {
    prisma.pregnancy.findFirst = jest.fn().mockResolvedValue(null);
    prisma.patientAllergy.findMany = jest.fn().mockResolvedValue([]);
    prisma.encounterDiagnosis.findMany = jest.fn().mockResolvedValue([]);
    prisma.labResult.findMany = jest.fn().mockResolvedValue([]);
    mockDashboardVitals({
      encounterVitals: {
        pulseRate: 72,
        systolic: 120,
        diastolic: null,
        recordedAt: new Date('2026-06-15T09:30:00.000Z'),
      },
    });

    const result = await service.getDashboard(patientUser);

    expect(result.latestVitals).toEqual({
      pulseRate: 72,
      systolic: 120,
      diastolic: null,
      recordedAt: new Date('2026-06-15T09:30:00.000Z'),
      bloodPressureStatus: null,
    });
  });
});
