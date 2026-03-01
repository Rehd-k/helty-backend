import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/create-patient.dto';
import { customAlphabet } from 'nanoid';
import { Prisma } from '@prisma/client';

@Injectable()
export class PatientService {
  private nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);
  private readonly logger = new Logger(PatientService.name);

  constructor(private prisma: PrismaService) { }

  async create(createPatientDto: CreatePatientDto, req: any) {

    const patientId = `${this.nanoid()}`;
    const data: any = {
      patientId,
      title: createPatientDto.title,
      surname: createPatientDto.surname,
      firstName: createPatientDto.firstName,
      dob: new Date(createPatientDto.dob),
      gender: createPatientDto.gender,
      maritalStatus: createPatientDto.maritalStatus,
      nationality: createPatientDto.nationality || '',
      stateOfOrigin: createPatientDto.stateOfOrigin || '',
      lga: createPatientDto.lga || '',
      town: createPatientDto.town || '',
      permanentAddress: createPatientDto.permanentAddress || '',
      createdById: req.user.sub,
      updatedById: req.user.sub,
    };

    if (createPatientDto.otherName) data.otherName = createPatientDto.otherName;
    if (createPatientDto.religion) data.religion = createPatientDto.religion;
    if (createPatientDto.email) data.email = createPatientDto.email;
    if (createPatientDto.preferredLanguage) data.preferredLanguage = createPatientDto.preferredLanguage;
    if (createPatientDto.phoneNumber) data.phoneNumber = createPatientDto.phoneNumber;
    if (createPatientDto.addressOfResidence) data.addressOfResidence = createPatientDto.addressOfResidence;
    if (createPatientDto.profession) data.profession = createPatientDto.profession;
    if (createPatientDto.nextOfKinName) data.nextOfKinName = createPatientDto.nextOfKinName;
    if (createPatientDto.nextOfKinPhone) data.nextOfKinPhone = createPatientDto.nextOfKinPhone;
    if (createPatientDto.nextOfKinAddress) data.nextOfKinAddress = createPatientDto.nextOfKinAddress;
    if (createPatientDto.nextOfKinRelationship) data.nextOfKinRelationship = createPatientDto.nextOfKinRelationship;
    if (createPatientDto.hmo) data.hmo = createPatientDto.hmo;
    if (createPatientDto.fingerprintData) data.fingerprintData = createPatientDto.fingerprintData;
    if (createPatientDto.cardNo) data.cardNo = createPatientDto.cardNo;

    const newPatient = this.prisma.patient.create({
      data,
    });
    return newPatient;
  }

  private readonly ALLOWED_FILTER_FIELDS = new Set([
    'patientId', 'firstName', 'surname', 'otherName', 'email',
    'phoneNumber', 'gender', 'maritalStatus', 'nationality',
    'stateOfOrigin', 'lga', 'town', 'permanentAddress', 'profession',
    'nextOfKinName', 'nextOfKinPhone', 'nextOfKinRelationship',
  ]);

  private readonly ALLOWED_SORT_FIELDS = new Set([
    'patientId', 'firstName', 'surname', 'otherName', 'email',
    'phoneNumber', 'gender', 'maritalStatus', 'nationality',
    'stateOfOrigin', 'lga', 'town', 'permanentAddress', 'profession',
    'nextOfKinName', 'nextOfKinPhone', 'nextOfKinRelationship',
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
  ) {


    const where: Prisma.PatientWhereInput = {}

    if (search && search.trim() !== '') {
      const trimmedSearch = search.trim()

      if (filterCategory === 'patientId') {
        where.patientId = {
          contains: trimmedSearch.toUpperCase(),
          mode: 'insensitive',
        }
      }

      else if (filterCategory === 'fullName') {
        where.OR = [
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
        ]
      }


      else if (filterCategory === 'nameIdPhonenumber') {

        where.OR = [
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
        ]
      }

      else if (
        filterCategory &&
        this.ALLOWED_FILTER_FIELDS.has(filterCategory)
      ) {
        where[filterCategory] = {
          contains: trimmedSearch,
          mode: 'insensitive',
        }
      }
    }


    if (fromDate && toDate) {
      where.createdAt = {
        gte: new Date(fromDate),
        lte: new Date(toDate),
      }
    }

    let orderBy: Prisma.PatientOrderByWithRelationInput = {
      createdAt: Prisma.SortOrder.desc,
    }

    if (
      sortBy &&
      sortBy.trim() !== '' &&
      this.ALLOWED_SORT_FIELDS.has(sortBy)
    ) {
      orderBy = {
        [sortBy]: isAscending
          ? Prisma.SortOrder.asc
          : Prisma.SortOrder.desc,
      }
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
              lastName: true
            },
          },
          updatedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            },
          },
          appointments: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
          admissions: {
            take: 3,
            orderBy: { createdAt: 'desc' },
          },
          transactions: {
            take: 3,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),

      this.prisma.patient.count({
        where,
      }),
    ])


    return {
      patients,
      total,
      skip,
      take,
    }
  }

  async findOne(id: string) {
    return this.prisma.patient.findUnique({
      where: { id },
      include: {
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
      },
    });
  }

  async update(id: string, updatePatientDto: UpdatePatientDto) {
    return this.prisma.patient.update({
      where: { id },
      data: updatePatientDto,
    });
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
