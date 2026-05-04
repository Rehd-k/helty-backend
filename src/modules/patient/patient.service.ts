import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/create-patient.dto';
import { customAlphabet } from 'nanoid';
import { PatientStatus, Prisma } from '@prisma/client';

@Injectable()
export class PatientService {
  private nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);
  private readonly logger = new Logger(PatientService.name);

  constructor(private prisma: PrismaService) {}

  /** Ward whose trimmed name is `OPD` (same rule as `update` ward handling). */
  private async resolveOpdWardId(): Promise<string> {
    const wards = await this.prisma.ward.findMany({
      select: { id: true, name: true },
    });
    const opd = wards.find((w) => w.name?.trim().toUpperCase() === 'OPD');
    if (!opd) {
      throw new BadRequestException(
        'No ward named "OPD" exists. Create it before using listStatusFilter.',
      );
    }
    return opd.id;
  }

  async create(
    createPatientDto: CreatePatientDto,
    req: { user: { sub: string } },
  ) {
    const staffId = req.user.sub;
    const wardId = createPatientDto.wardId;
    const hmoId = createPatientDto.hmoId;

    const [staff, ward, hmo] = await Promise.all([
      this.prisma.staff.findUnique({ where: { id: staffId } }),
      wardId
        ? this.prisma.ward.findUnique({ where: { id: wardId } })
        : Promise.resolve(null),
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

    const patientId = this.nanoid();

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
      wardId: wardId ?? null,
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

    try {
      const newPatient = await this.prisma.patient.create({ data });
      this.logger.log(
        `Patient created id=${newPatient.id} patientId=${patientId}`,
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
    'surname',
    'firstName',
    'otherName',
    'email',
    'phoneNumber',
    'addressOfResidence',
    'hmo',
    'nextOfKinName',
    'nextOfKinPhone',
    'nextOfKinAddress',
    'nextOfKinRelationship',
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

      if (filterCategory === 'patientId') {
        andParts.push({
          patientId: {
            contains: trimmedSearch.toUpperCase(),
            mode: 'insensitive',
          },
        });
      } else if (filterCategory === 'fullName') {
        andParts.push({
          OR: [
            {
              firstName: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
            {
              surname: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
          ],
        });
      } else if (filterCategory === 'nameIdPhonenumber') {
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
            {
              firstName: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
            {
              surname: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
          ],
        });
      } else if (
        filterCategory &&
        this.ALLOWED_FILTER_FIELDS.has(filterCategory)
      ) {
        andParts.push({
          [filterCategory]: {
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
        take,
        orderBy,
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
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
        ward: true,
        appointments: {
          orderBy: { date: 'desc' },
        },
        admissions: {
          orderBy: { admissionDate: 'desc' },
        },
        payments: {
          orderBy: { date: 'desc' },
        },
        medicalHistories: {
          orderBy: { createdAt: 'desc' },
        },
        doctorReports: {
          orderBy: { createdAt: 'desc' },
        },
        labReports: {
          orderBy: { date: 'desc' },
        },
        radiologyReports: {
          orderBy: { date: 'desc' },
        },
        prescriptions: {
          orderBy: { startDate: 'desc' },
        },
        invoice: {
          orderBy: { createdAt: 'desc' },
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
        appointments: true,
        admissions: true,
        payments: true,
        medicalHistories: true,
        doctorReports: true,
        labReports: true,
        radiologyReports: true,
        prescriptions: true,
        invoice: true,
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
        data.hmo = null;
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
      (data as Record<string, unknown>).patientId = this.nanoid();
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
    return this.prisma.patient.delete({
      where: { id },
    });
  }

  async search(query: string) {
    return this.prisma.patient.findMany({
      where: {
        OR: [
          { patientId: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { surname: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phoneNumber: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });
  }

  async getPatientHistory(patientId: string) {
    return this.prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        patientId: true,
        firstName: true,
        surname: true,
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
