import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { LoggerModule } from 'nestjs-pino';
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

@Module({
  imports: [
    // pino-http logger (nestjs-pino) will attach request/response info
    // LoggerModule.forRoot({
    //   pinoHttp: {
    //     level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
    //     transport:
    //       process.env.NODE_ENV !== 'production'
    //         ? {
    //             target: 'pino-pretty',
    //             options: { colorize: true, translateTime: true },
    //           }
    //         : undefined,
    //   },
    // }),
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
    PrescriptionModule,
    ServiceModule,
    TransactionModule,
    StaffModule,
    AuthModule,
    DepartmentModule,
    InvoiceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],

})
export class AppModule { }
