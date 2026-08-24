import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/create-patient.dto';
import { PatientStatus, Prisma } from '@prisma/client';
import { endOfDay, startOfDay } from '../../common/utils/date-range';
import { generateHumanReadableId } from '../../common/utils/human-readable-id.util';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';
import {
  buildPatientNameSearchWhere,
  normalizePatientSearchName,
} from '../../common/utils/patient-name-search.util';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

export type SimilarPatientMatch = {
  id: string;
  patientId: string | null;
  firstName: string | null;
  surname: string | null;
  otherName: string | null;
  dob: Date | null;
  phoneNumber: string | null;
};

/** Tables with a simple `patientId` FK that can be bulk-reassigned on merge. */
const PATIENT_FK_UPDATE_MANY = [
  'appointment',
  'appointmentNotification',
  'admission',
  'payment',
  'medicalHistory',
  'doctorReport',
  'labReport',
  'radiologyReport',
  'prescription',
  'patientMedicationDoseLog',
  'prescriptionRefillRequest',
  'consumableUsageEvent',
  'invoice',
  'encounter',
  'labRequest',
  'patientVitals',
  'waitingPatient',
  'patientAllergy',
  'medicationOrder',
  'medicationRequest',
  'referral',
  'patientComplaint',
  'patientFeedback',
  'emergencyRequest',
  'safetyIncident',
  'infectionCase',
  'labOrder',
  'dialysisSession',
  'pregnancy',
  'postnatalVisit',
  'gynaeProcedure',
  'surgeryRequest',
  'radiologyOrder',
  'patientArchivedEncounter',
] as const;

@Injectable()
export class PatientService {
  private readonly logger = new Logger(PatientService.name);

  constructor(private prisma: PrismaService) { }

  private similarMatchSelect = {
    id: true,
    patientId: true,
    firstName: true,
    surname: true,
    otherName: true,
    dob: true,
    phoneNumber: true,
  } as const;

  /**
   * Case-insensitive name similarity + same calendar DOB.
   * Uses contains/equals-style Prisma filters (practical fuzzy match).
   */
  async findSimilarMatches(input: {
    firstName: string;
    surname: string;
    otherName?: string;
    dob: string | Date;
  }): Promise<SimilarPatientMatch[]> {
    const firstName = input.firstName.trim();
    const surname = input.surname.trim();
    const otherName = input.otherName?.trim();
    const dobAnchor = input.dob instanceof Date ? input.dob : new Date(input.dob);
    if (Number.isNaN(dobAnchor.getTime())) {
      throw new BadRequestException('Invalid date of birth.');
    }
    if (!firstName || !surname) {
      throw new BadRequestException('firstName and surname are required.');
    }

    const dobFrom = startOfDay(dobAnchor);
    const dobTo = endOfDay(dobAnchor);

    const nameAnd: Prisma.PatientWhereInput[] = [
      {
        OR: [
          { firstName: { equals: firstName, mode: 'insensitive' } },
          { firstName: { contains: firstName, mode: 'insensitive' } },
        ],
      },
      {
        OR: [
          { surname: { equals: surname, mode: 'insensitive' } },
          { surname: { contains: surname, mode: 'insensitive' } },
        ],
      },
    ];

    if (otherName) {
      nameAnd.push({
        OR: [
          { otherName: { equals: otherName, mode: 'insensitive' } },
          { otherName: { contains: otherName, mode: 'insensitive' } },
        ],
      });
    }

    const normalized = normalizePatientSearchName(firstName, otherName, surname);
    const where: Prisma.PatientWhereInput = {
      AND: [
        { dob: { gte: dobFrom, lte: dobTo } },
        {
          OR: [
            { AND: nameAnd },
            ...(normalized
              ? [{ searchName: { contains: normalized, mode: 'insensitive' as const } }]
              : []),
          ],
        },
      ],
    };

    return this.prisma.patient.findMany({
      where,
      select: this.similarMatchSelect,
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Ward whose trimmed name is `OPD` (same rule as `update` ward handling). */
  private async resolveOpdWardId(): Promise<string> {
    const wards = await this.prisma.ward.findMany({
      select: { id: true, name: true },
    });
    const opd = wards.find((w) => w.name?.trim().toUpperCase() === 'OPD');
    if (!opd) {
      throw new BadRequestException(
        'No ward named "OPD" exists. Create it before registering patients.',
      );
    }
    return opd.id;
  }

  async create(
    createPatientDto: CreatePatientDto,
    req: { user: { sub: string } },
    options?: { forceCreate?: boolean },
  ) {
    const staffId = req.user.sub;
    let wardId = createPatientDto.wardId?.trim() || undefined;
    const hmoId = createPatientDto.hmoId;
    const forceCreate =
      options?.forceCreate === true || createPatientDto.forceCreate === true;

    if (!wardId) {
      wardId = await this.resolveOpdWardId();
    }

    const [staff, ward, hmo] = await Promise.all([
      this.prisma.staff.findUnique({ where: { id: staffId } }),
      this.prisma.ward.findUnique({ where: { id: wardId } }),
      hmoId
        ? this.prisma.hmo.findUnique({ where: { id: hmoId } })
        : Promise.resolve(null),
    ]);

    if (!staff) {
      throw new NotFoundException(`Staff "${staffId}" not found.`);
    }
    if (wardId && !ward) {
      throw new NotFoundException(`Ward "${wardId}" not found.`);
    }
    if (hmoId && !hmo) {
      throw new NotFoundException(`HMO "${hmoId}" not found.`);
    }

    // Hard phone uniqueness — never bypassed by forceCreate.
    if (createPatientDto.phoneNumber) {
      const phoneOwner = await this.prisma.patient.findUnique({
        where: { phoneNumber: createPatientDto.phoneNumber },
        select: { id: true },
      });
      if (phoneOwner) {
        throw new ConflictException(
          'This phone number is already registered.',
        );
      }
    }

    if (
      !forceCreate &&
      createPatientDto.firstName &&
      createPatientDto.surname &&
      createPatientDto.dob
    ) {
      const candidates = await this.findSimilarMatches({
        firstName: createPatientDto.firstName,
        surname: createPatientDto.surname,
        otherName: createPatientDto.otherName,
        dob: createPatientDto.dob,
      });
      if (candidates.length > 0) {
        throw new ConflictException({
          message:
            'Similar patient records found. Confirm identity or pass forceCreate=true to register anyway.',
          code: 'PATIENT_SIMILAR_MATCHES',
          candidates,
        });
      }
    }

    const patientId = generateHumanReadableId();

    const data: Prisma.PatientUncheckedCreateInput = {
      patientId,
      title: createPatientDto.title ?? null,
      surname: createPatientDto.surname ?? '',
      firstName: createPatientDto.firstName,
      dob: createPatientDto.dob ? new Date(createPatientDto.dob) : null,
      gender: createPatientDto.gender ?? null,
      maritalStatus: createPatientDto.maritalStatus ?? null,
      nationality: createPatientDto.nationality || '',
      stateOfOrigin: createPatientDto.stateOfOrigin || '',
      lga: createPatientDto.lga || '',
      town: createPatientDto.town || '',
      permanentAddress: createPatientDto.permanentAddress || '',
      createdById: staffId,
      updatedById: staffId,
      wardId,
      hmoId: hmoId ?? null,
      hmo: !hmoId && createPatientDto.hmo ? createPatientDto.hmo : null,
    };

    if (createPatientDto.otherName) data.otherName = createPatientDto.otherName;
    if (createPatientDto.religion) data.religion = createPatientDto.religion;
    if (createPatientDto.email) data.email = createPatientDto.email;
    if (createPatientDto.preferredLanguage)
      data.preferredLanguage = createPatientDto.preferredLanguage;
    if (createPatientDto.phoneNumber)
      data.phoneNumber = createPatientDto.phoneNumber;
    if (createPatientDto.addressOfResidence)
      data.addressOfResidence = createPatientDto.addressOfResidence;
    if (createPatientDto.profession)
      data.profession = createPatientDto.profession;
    if (createPatientDto.nextOfKinName)
      data.nextOfKinName = createPatientDto.nextOfKinName;
    if (createPatientDto.nextOfKinPhone)
      data.nextOfKinPhone = createPatientDto.nextOfKinPhone;
    if (createPatientDto.nextOfKinAddress)
      data.nextOfKinAddress = createPatientDto.nextOfKinAddress;
    if (createPatientDto.nextOfKinRelationship)
      data.nextOfKinRelationship = createPatientDto.nextOfKinRelationship;
    if (createPatientDto.fingerprintData)
      data.fingerprintData = createPatientDto.fingerprintData;
    if (createPatientDto.cardNo) data.cardNo = createPatientDto.cardNo;

    data.searchName = normalizePatientSearchName(
      data.firstName as string | null | undefined,
      data.otherName as string | null | undefined,
      data.surname as string | null | undefined,
    );

    try {
      if (!createPatientDto.phoneNumber) {
        delete data.patientId
      }
      const newPatient = await this.prisma.patient.create({ data });
      this.logger.log(
        `Patient created id=${newPatient.id} patientId=${patientId} forceCreate=${forceCreate}`,
      );
      return newPatient;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = (e.meta?.target as string[] | undefined) ?? [];
        if (target.includes('phoneNumber')) {
          throw new ConflictException(
            'This phone number is already registered.',
          );
        }
      }
      throw e;
    }
  }

  /**
   * Super-admin merge: reassign all patient FK rows from duplicate → survivor, then delete duplicate.
   * Survivor keeps unique fields (phoneNumber, patientId). Devices on the duplicate are deleted.
   */
  async mergePatients(
    survivorId: string,
    duplicateId: string,
    actorStaffId: string,
  ) {
    if (survivorId === duplicateId) {
      throw new BadRequestException(
        'survivorId and duplicateId must be different patients.',
      );
    }

    const [survivor, duplicate, actor] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: survivorId } }),
      this.prisma.patient.findUnique({ where: { id: duplicateId } }),
      this.prisma.staff.findUnique({
        where: { id: actorStaffId },
        select: { id: true },
      }),
    ]);

    if (!survivor) {
      throw new NotFoundException(`Survivor patient "${survivorId}" not found.`);
    }
    if (!duplicate) {
      throw new NotFoundException(
        `Duplicate patient "${duplicateId}" not found.`,
      );
    }
    if (!actor) {
      throw new NotFoundException(`Staff "${actorStaffId}" not found.`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Devices: unique deviceKey / fcmToken — drop duplicate's devices.
      await tx.patientDevice.deleteMany({ where: { patientId: duplicateId } });

      // Wallet: patientId is unique — merge transactions then remove duplicate wallet.
      const [survivorWallet, duplicateWallet] = await Promise.all([
        tx.patientWallet.findUnique({ where: { patientId: survivorId } }),
        tx.patientWallet.findUnique({ where: { patientId: duplicateId } }),
      ]);
      if (duplicateWallet) {
        if (survivorWallet) {
          await tx.walletTransaction.updateMany({
            where: { walletId: duplicateWallet.id },
            data: { walletId: survivorWallet.id },
          });
          const mergedBalance =
            Number(survivorWallet.balance) + Number(duplicateWallet.balance);
          await tx.patientWallet.update({
            where: { id: survivorWallet.id },
            data: { balance: mergedBalance },
          });
          await tx.patientWallet.delete({ where: { id: duplicateWallet.id } });
        } else {
          await tx.patientWallet.update({
            where: { id: duplicateWallet.id },
            data: { patientId: survivorId },
          });
        }
      }

      // Family links: avoid self-links and unique (parent, child) collisions.
      await tx.patientFamilyLink.deleteMany({
        where: {
          OR: [
            { parentPatientId: duplicateId, childPatientId: survivorId },
            { parentPatientId: survivorId, childPatientId: duplicateId },
            { parentPatientId: duplicateId, childPatientId: duplicateId },
          ],
        },
      });
      const survivorAsParent = await tx.patientFamilyLink.findMany({
        where: { parentPatientId: survivorId },
        select: { childPatientId: true },
      });
      const survivorChildIds = new Set(
        survivorAsParent.map((l) => l.childPatientId),
      );
      const dupAsParent = await tx.patientFamilyLink.findMany({
        where: { parentPatientId: duplicateId },
      });
      for (const link of dupAsParent) {
        if (
          link.childPatientId === survivorId ||
          survivorChildIds.has(link.childPatientId)
        ) {
          await tx.patientFamilyLink.delete({ where: { id: link.id } });
        } else {
          await tx.patientFamilyLink.update({
            where: { id: link.id },
            data: { parentPatientId: survivorId },
          });
        }
      }
      const survivorAsChild = await tx.patientFamilyLink.findMany({
        where: { childPatientId: survivorId },
        select: { parentPatientId: true },
      });
      const survivorParentIds = new Set(
        survivorAsChild.map((l) => l.parentPatientId),
      );
      const dupAsChild = await tx.patientFamilyLink.findMany({
        where: { childPatientId: duplicateId },
      });
      for (const link of dupAsChild) {
        if (
          link.parentPatientId === survivorId ||
          survivorParentIds.has(link.parentPatientId)
        ) {
          await tx.patientFamilyLink.delete({ where: { id: link.id } });
        } else {
          await tx.patientFamilyLink.update({
            where: { id: link.id },
            data: { childPatientId: survivorId },
          });
        }
      }

      // Baby mother + registered-patient FKs (not plain patientId).
      await tx.baby.updateMany({
        where: { motherId: duplicateId },
        data: { motherId: survivorId },
      });
      const survivorRegistered = await tx.baby.findFirst({
        where: { registeredPatientId: survivorId },
        select: { id: true },
      });
      if (survivorRegistered) {
        await tx.baby.updateMany({
          where: { registeredPatientId: duplicateId },
          data: { registeredPatientId: null },
        });
      } else {
        await tx.baby.updateMany({
          where: { registeredPatientId: duplicateId },
          data: { registeredPatientId: survivorId },
        });
      }

      for (const model of PATIENT_FK_UPDATE_MANY) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any)[model].updateMany({
          where: { patientId: duplicateId },
          data: { patientId: survivorId },
        });
      }

      // Clear unique fields on duplicate so delete cannot collide with survivor.
      await tx.patient.update({
        where: { id: duplicateId },
        data: {
          phoneNumber: null,
          patientId: null,
        },
      });

      await tx.patient.delete({ where: { id: duplicateId } });
    });

    this.logger.log(
      `Patient merge: survivor=${survivorId} duplicate=${duplicateId} by staff=${actorStaffId}`,
    );

    return this.prisma.patient.findUnique({
      where: { id: survivorId },
      include: {
        createdBy: { select: staffBriefSelect },
        updatedBy: { select: staffBriefSelect },
        ward: true,
        hmoProvider: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  private readonly ALLOWED_FILTER_FIELDS = new Set([
    'patientId',
    'firstName',
    'surname',
    'otherName',
    'email',
    'phoneNumber',
    'gender',
    'maritalStatus',
    'nationality',
    'stateOfOrigin',
    'lga',
    'town',
    'permanentAddress',
    'profession',
    'nextOfKinName',
    'nextOfKinPhone',
    'nextOfKinRelationship',
  ]);

  /** Fields accepted on PATCH; only keys present in the body (not undefined) are written. */
  private static readonly PATIENT_PATCH_KEYS = [
    'patientId',
    'title',
    'cardNo',
    'surname',
    'firstName',
    'otherName',
    'dob',
    'gender',
    'maritalStatus',
    'nationality',
    'stateOfOrigin',
    'lga',
    'town',
    'permanentAddress',
    'religion',
    'email',
    'preferredLanguage',
    'phoneNumber',
    'addressOfResidence',
    'profession',
    'hmo',
    'nextOfKinName',
    'nextOfKinPhone',
    'nextOfKinAddress',
    'nextOfKinRelationship',
    'fingerprintData',
    'status',
  ] as const;

  private readonly ALLOWED_SORT_FIELDS = new Set([
    'patientId',
    'firstName',
    'surname',
    'otherName',
    'email',
    'phoneNumber',
    'gender',
    'maritalStatus',
    'nationality',
    'stateOfOrigin',
    'lga',
    'town',
    'permanentAddress',
    'profession',
    'nextOfKinName',
    'nextOfKinPhone',
    'nextOfKinRelationship',
  ]);

  async findRegisteredToday(
    asOf?: string,
    skip = 0,
    take = 50,
    search?: string,
  ) {
    const anchor = asOf ? new Date(asOf) : new Date();
    const day = Number.isNaN(anchor.getTime()) ? new Date() : anchor;
    const from = startOfDay(day);
    const to = endOfDay(day);

    const andParts: Prisma.PatientWhereInput[] = [
      { createdAt: { gte: from, lte: to } },
    ];

    if (search?.trim()) {
      const trimmedSearch = search.trim();
      andParts.push({
        OR: [
          {
            phoneNumber: {
              contains: trimmedSearch,
              mode: 'insensitive',
            },
          },
          {
            patientId: {
              contains: trimmedSearch.toUpperCase(),
              mode: 'insensitive',
            },
          },
          buildPatientNameSearchWhere(trimmedSearch),
        ],
      });
    }

    const where: Prisma.PatientWhereInput =
      andParts.length === 1 ? andParts[0] : { AND: andParts };

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: staffBriefSelect },
          ward: {
            select: { id: true, name: true },
          },
          hmoProvider: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      date: from.toISOString().slice(0, 10),
      from: from.toISOString(),
      to: to.toISOString(),
      patients,
      total,
      skip,
      take,
    };
  }

  async findAll(
    skip = 0,
    take = 10,
    search?: string,
    filterCategory?: string,
    fromDate?: string,
    toDate?: string,
    sortBy?: string,
    isAscending = false,
    listStatusFilter?: string,
  ) {
    /** Directory listing must never include incomplete records (no hospital id). */
    const andParts: Prisma.PatientWhereInput[] = [{ patientId: { not: null } }];

    const listFilter = listStatusFilter?.trim();
    if (
      listFilter &&
      listFilter !== 'onlyAdmitted' &&
      listFilter !== 'excludeAdmitted'
    ) {
      throw new BadRequestException(
        `Invalid listStatusFilter "${listStatusFilter}". Use onlyAdmitted or excludeAdmitted.`,
      );
    }

    if (search && search.trim() !== '') {
      const trimmedSearch = search.trim();
      /** Empty filterCategory → search name, hospital id, and phone (directory default). */
      const category = filterCategory?.trim() || 'nameIdPhonenumber';

      if (category === 'patientId') {
        andParts.push({
          patientId: {
            contains: trimmedSearch.toUpperCase(),
            mode: 'insensitive',
          },
        });
      } else if (category === 'fullName') {
        andParts.push(buildPatientNameSearchWhere(trimmedSearch));
      } else if (category === 'nameIdPhonenumber') {
        andParts.push({
          OR: [
            {
              phoneNumber: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
            {
              patientId: {
                contains: trimmedSearch.toUpperCase(),
                mode: 'insensitive',
              },
            },
            buildPatientNameSearchWhere(trimmedSearch),
          ],
        });
      } else if (this.ALLOWED_FILTER_FIELDS.has(category)) {
        andParts.push({
          [category]: {
            contains: trimmedSearch,
            mode: 'insensitive',
          },
        } as Prisma.PatientWhereInput);
      }
    }

    if (fromDate && toDate) {
      andParts.push({
        createdAt: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      });
    }

    if (listFilter === 'onlyAdmitted' || listFilter === 'excludeAdmitted') {
      const opdWardId = await this.resolveOpdWardId();
      await this.prisma.patient.updateMany({
        where: { wardId: null },
        data: {
          wardId: opdWardId,
          status: PatientStatus.OUTPATIENT,
        },
      });
      if (listFilter === 'onlyAdmitted') {
        andParts.push({ wardId: { not: opdWardId } });
      } else {
        andParts.push({ wardId: opdWardId });
      }
    }

    const where: Prisma.PatientWhereInput =
      andParts.length === 1 ? andParts[0] : { AND: andParts };

    let orderBy: Prisma.PatientOrderByWithRelationInput = {
      createdAt: Prisma.SortOrder.desc,
    };

    if (
      sortBy &&
      sortBy.trim() !== '' &&
      this.ALLOWED_SORT_FIELDS.has(sortBy)
    ) {
      orderBy = {
        [sortBy]: isAscending ? Prisma.SortOrder.asc : Prisma.SortOrder.desc,
      };
    }

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take: Math.min(take * 5, 100),
        orderBy,
        include: {
          createdBy: { select: staffBriefSelect },
          updatedBy: { select: staffBriefSelect },
          ward: true,
          hmoProvider: {
            select: { id: true, name: true, code: true },
          },
        },
      }),

      this.prisma.patient.count({
        where,
      }),
    ]);

    return {
      patients,
      total,
      skip,
      take,
    };
  }

  async findOne(id: string) {
    return this.prisma.patient.findUnique({
      where: { id },
      include: {
        createdBy: { select: staffBriefSelect },
        updatedBy: { select: staffBriefSelect },
        ward: true,
        appointments: {
          orderBy: { date: 'desc' },
          include: { createdBy: { select: staffBriefSelect } },
        },
        admissions: {
          orderBy: { admissionDate: 'desc' },
          include: { createdBy: { select: staffBriefSelect } },
        },
        payments: {
          orderBy: { date: 'desc' },
          include: { createdBy: { select: staffBriefSelect } },
        },
        medicalHistories: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: staffBriefSelect } },
        },
        doctorReports: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: staffBriefSelect } },
        },
        labReports: {
          orderBy: { date: 'desc' },
          include: { createdBy: { select: staffBriefSelect } },
        },
        radiologyReports: {
          orderBy: { date: 'desc' },
          include: { createdBy: { select: staffBriefSelect } },
        },
        prescriptions: {
          orderBy: { startDate: 'desc' },
          include: { createdBy: { select: staffBriefSelect } },
        },
        invoice: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: staffBriefSelect } },
        },
        hmoProvider: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.patient.findUnique({
      where: { patientId },
      include: {
        createdBy: { select: staffBriefSelect },
        updatedBy: { select: staffBriefSelect },
        appointments: {
          include: { createdBy: { select: staffBriefSelect } },
        },
        admissions: {
          include: { createdBy: { select: staffBriefSelect } },
        },
        payments: {
          include: { createdBy: { select: staffBriefSelect } },
        },
        medicalHistories: {
          include: { createdBy: { select: staffBriefSelect } },
        },
        doctorReports: {
          include: { createdBy: { select: staffBriefSelect } },
        },
        labReports: {
          include: { createdBy: { select: staffBriefSelect } },
        },
        radiologyReports: {
          include: { createdBy: { select: staffBriefSelect } },
        },
        prescriptions: {
          include: { createdBy: { select: staffBriefSelect } },
        },
        invoice: {
          include: { createdBy: { select: staffBriefSelect } },
        },
        hmoProvider: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async update(
    id: string,
    updatePatientDto: UpdatePatientDto,
    req: { user: { sub: string } },
  ) {
    const staffId = req.user.sub;
    const actor = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });
    if (!actor) {
      throw new NotFoundException(`Staff "${staffId}" not found.`);
    }

    const existing = await this.prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Patient with id ${id} not found`);
    }

    const data: Prisma.PatientUpdateInput = {
      updatedBy: { connect: { id: staffId } },
    };

    for (const key of PatientService.PATIENT_PATCH_KEYS) {
      const value = updatePatientDto[key];
      if (value !== undefined) {
        if (key === 'dob') {
          (data as Record<string, unknown>).dob = value
            ? new Date(value as string)
            : null;
          continue;
        }
        (data as Record<string, unknown>)[key] = value;
      }
    }

    if (updatePatientDto.hmoId !== undefined) {
      if (updatePatientDto.hmoId === null) {
        data.hmoProvider = { disconnect: true };
        data.hmo = null;
      } else {
        const hmo = await this.prisma.hmo.findUnique({
          where: { id: updatePatientDto.hmoId },
        });
        if (!hmo) {
          throw new NotFoundException(
            `HMO "${updatePatientDto.hmoId}" not found.`,
          );
        }
        data.hmoProvider = { connect: { id: updatePatientDto.hmoId } };
        data.hmo = hmo.name;
      }
    }

    if (updatePatientDto.wardId !== undefined) {
      if (updatePatientDto.wardId === null) {
        data.ward = { disconnect: true };
      } else {
        const ward = await this.prisma.ward.findUnique({
          where: { id: updatePatientDto.wardId },
        });
        if (!ward) {
          throw new NotFoundException(
            `Ward "${updatePatientDto.wardId}" not found.`,
          );
        }
        data.ward = { connect: { id: updatePatientDto.wardId } };
        if (ward.name?.trim().toUpperCase() === 'OPD') {
          data.status = PatientStatus.OUTPATIENT;
        }
      }
    }

    // Only backfill when the record never had a hospital id; do not rotate id on every partial PATCH.
    if (!existing.patientId && updatePatientDto.patientId === undefined) {
      (data as Record<string, unknown>).patientId = generateHumanReadableId();
    }

    const nameChanged =
      updatePatientDto.firstName !== undefined ||
      updatePatientDto.otherName !== undefined ||
      updatePatientDto.surname !== undefined;
    if (nameChanged) {
      (data as Record<string, unknown>).searchName = normalizePatientSearchName(
        updatePatientDto.firstName !== undefined
          ? updatePatientDto.firstName
          : existing.firstName,
        updatePatientDto.otherName !== undefined
          ? updatePatientDto.otherName
          : existing.otherName,
        updatePatientDto.surname !== undefined
          ? updatePatientDto.surname
          : existing.surname,
      );
    }

    try {
      return await this.prisma.patient.update({
        where: { id },
        data,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = (e.meta?.target as string[] | undefined) ?? [];
        if (target.includes('phoneNumber')) {
          throw new ConflictException(
            'This phone number is already registered.',
          );
        }
      }
      throw e;
    }
  }
  async remove(id: string) {
    const existing = await this.prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Patient "${id}" not found.`);
    }

    try {
      await this.prisma.patient.delete({ where: { id } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ConflictException(
          'Patient cannot be deleted because linked medical or billing records exist.',
        );
      }
      throw e;
    }
  }

  async search(query: string) {
    const trimmed = query.trim();
    return this.prisma.patient.findMany({
      where: {
        OR: [
          { patientId: { contains: trimmed, mode: 'insensitive' } },
          { email: { contains: trimmed, mode: 'insensitive' } },
          { phoneNumber: { contains: trimmed, mode: 'insensitive' } },
          buildPatientNameSearchWhere(trimmed),
        ],
      },
      include: {
        createdBy: { select: staffBriefSelect },
      },
      take: 10,
    });
  }

  async getPatientHistory(patientId: string) {
    return this.prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        ...patientNameFieldsSelect,
        appointments: true,
        admissions: true,
        medicalHistories: true,
        doctorReports: true,
        labReports: true,
        radiologyReports: true,
        prescriptions: true,
      },
    });
  }
}
