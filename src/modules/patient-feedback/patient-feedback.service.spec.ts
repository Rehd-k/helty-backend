import { ConflictException, NotFoundException } from '@nestjs/common';
import { PatientFeedbackKind, PatientFeedbackStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { PatientFeedbackService } from './patient-feedback.service';

describe('PatientFeedbackService', () => {
  const prisma = {
    patientFeedback: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const service = new PatientFeedbackService(
    prisma as unknown as PrismaService,
  );

  const patientUser: PatientJwtPayload = {
    sub: 'patient-uuid-1',
    patientId: 'AB12CD34',
    accountType: 'PATIENT',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates feedback for the authenticated patient', async () => {
    prisma.patientFeedback.create.mockResolvedValue({ id: 'fb-1' });

    await service.create(patientUser, {
      kind: PatientFeedbackKind.SUGGESTION,
      subject: 'Longer clinic hours',
      message: 'Please extend Friday clinic hours.',
    });

    expect(prisma.patientFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'patient-uuid-1',
          kind: PatientFeedbackKind.SUGGESTION,
        }),
      }),
    );
  });

  it('lists only feedback owned by the authenticated patient', async () => {
    prisma.patientFeedback.findMany.mockResolvedValue([]);
    prisma.patientFeedback.count.mockResolvedValue(0);

    await service.list(patientUser, {
      status: PatientFeedbackStatus.OPEN,
      page: 2,
      limit: 10,
    });

    expect(prisma.patientFeedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: {
          patientId: 'patient-uuid-1',
          status: PatientFeedbackStatus.OPEN,
        },
      }),
    );
  });

  it('throws 404 for feedback not owned by the patient', async () => {
    prisma.patientFeedback.findFirst.mockResolvedValue(null);

    await expect(service.get(patientUser, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects patient updates once staff review has started', async () => {
    prisma.patientFeedback.findFirst.mockResolvedValue({
      id: 'fb-1',
      status: PatientFeedbackStatus.IN_REVIEW,
    });

    await expect(
      service.update(patientUser, 'fb-1', {
        subject: 'Updated',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('soft-closes open feedback on delete', async () => {
    prisma.patientFeedback.findFirst.mockResolvedValue({
      id: 'fb-1',
      status: PatientFeedbackStatus.OPEN,
    });
    prisma.patientFeedback.update.mockResolvedValue({
      id: 'fb-1',
      status: PatientFeedbackStatus.CLOSED,
    });

    const result = await service.remove(patientUser, 'fb-1');

    expect(result.status).toBe(PatientFeedbackStatus.CLOSED);
    expect(prisma.patientFeedback.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PatientFeedbackStatus.CLOSED },
      }),
    );
  });
});
