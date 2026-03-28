import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { PatientModule } from './modules/patient/patient.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { AdmissionModule } from './modules/admission/admission.module';
import { PaymentModule } from './modules/payment/payment.module';
import { MedicalHistoryModule } from './modules/medical-history/medical-history.module';
import { DoctorReportModule } from './modules/doctor-report/doctor-report.module';
import { LabReportModule } from './modules/lab-report/lab-report.module';
import { RadiologyReportModule } from './modules/radiology-report/radiology-report.module';
import { PrescriptionModule } from './modules/prescription/prescription.module';
import { ServiceModule } from './modules/service/service.module';
import { TransactionModule } from './modules/billing/billing.module';
import { StaffModule } from './modules/staff/staff.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepartmentModule } from './modules/department/department.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard, AccessGuard } from './common/guards';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { LoggerModule } from 'nestjs-pino';
import { BankModule } from './modules/bank/bank.module';
import { PatientVitalsModule } from './modules/patient-vitals/patient-vitals.module';
import { ConsultingRoomModule } from './modules/consulting-room/consulting-room.module';
import { WaitingPatientModule } from './modules/waiting-patient/waiting-patient.module';
import { WardModule } from './modules/ward/ward.module';
import { EncounterModule } from './modules/encounter/encounter.module';
import { LabRequestModule } from './modules/lab-request/lab-request.module';
import { ImagingRequestModule } from './modules/imaging-request/imaging-request.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { WardRoundNotesModule } from './modules/ward-round-notes/ward-round-notes.module';
import { ObstetricsModule } from './modules/obstetrics/obstetrics.module';
import { LabModule } from './modules/lab/lab.module';
import { ChatModule } from './modules/chat/chat.module';
import { RadiologyModule } from './modules/radiology/radiology.module';
import { MedicationOrderModule } from './modules/medication-order/medication-order.module';
import { StoreModule } from './modules/store/store.module';
import { PurchasesModule } from './modules/purchases/purchases.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    PatientModule,
    AppointmentModule,
    AdmissionModule,
    PaymentModule,
    MedicalHistoryModule,
    DoctorReportModule,
    LabReportModule,
    RadiologyReportModule,
    TransactionModule,
    PrescriptionModule,
    ServiceModule,
    StaffModule,
    AuthModule,
    DepartmentModule,
    InvoiceModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'info', // Set log level
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
              },
            }
            : undefined, // Pretty logs in development
      },
    }),
    BankModule,
    PatientVitalsModule,
    ConsultingRoomModule,
    WaitingPatientModule,
    WardModule,
    EncounterModule,
    LabRequestModule,
    ImagingRequestModule,
    PharmacyModule,
    WardRoundNotesModule,
    ObstetricsModule,
    LabModule,
    ChatModule,
    RadiologyModule,
    MedicationOrderModule,
    StoreModule,
    PurchasesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AppModule { }
