import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { StaffModule } from './modules/staff/staff.module';
import { AuthModule } from './modules/auth/auth.module';
import { PatientAuthModule } from './modules/patient-auth/patient-auth.module';
import { PatientMedicalRecordsModule } from './modules/patient-medical-records/patient-medical-records.module';
import { PatientLabReportsModule } from './modules/patient-lab-reports/patient-lab-reports.module';
import { PatientRadiologyReportsModule } from './modules/patient-radiology-reports/patient-radiology-reports.module';
import { PatientMedicationsModule } from './modules/patient-medications/patient-medications.module';
import { PatientBillingModule } from './modules/patient-billing/patient-billing.module';
import { PatientAppointmentsModule } from './modules/patient-appointments/patient-appointments.module';
import { PatientFeedbackModule } from './modules/patient-feedback/patient-feedback.module';
import { PatientProfileModule } from './modules/patient-profile/patient-profile.module';
import { PatientFamilyModule } from './modules/patient-family/patient-family.module';
import { DepartmentModule } from './modules/department/department.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LocalTimestampInterceptor } from './common/interceptors/local-timestamp.interceptor';
import { JwtAuthGuard, AccessGuard, ApprovedDeviceGuard } from './common/guards';
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
import { EncounterTemplateModule } from './modules/encounter-template/encounter-template.module';
import { LabRequestModule } from './modules/lab-request/lab-request.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { WardRoundNotesModule } from './modules/ward-round-notes/ward-round-notes.module';
import { ObstetricsModule } from './modules/obstetrics/obstetrics.module';
import { LabModule } from './modules/lab/lab.module';
import { RedisModule } from './redis/redis.module';
import { ChatModule } from './modules/chat/chat.module';
import { RadiologyModule } from './modules/radiology/radiology.module';
import { MedicationOrderModule } from './modules/medication-order/medication-order.module';
import { MedicationRequestModule } from './modules/medication-request/medication-request.module';
import { StoreModule } from './modules/store/store.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { DialysisModule } from './modules/dialysis/dialysis.module';
import { BillingAnalyticsModule } from './modules/billing-analytics/billing-analytics.module';
import { FrontdeskModule } from './modules/frontdesk/frontdesk.module';
import { HeltyDesktopModule } from './modules/helty-desktop/helty-desktop.module';
import { MedicationScheduleModule } from './modules/medication-schedule/medication-schedule.module';
import { NursesDashboardModule } from './modules/nurses-dashboard/nurses-dashboard.module';
import { HmoModule } from './modules/hmo/hmo.module';
import { InpatientNursingModule } from './modules/inpatient-nursing/inpatient-nursing.module';
import { NursingModule } from './modules/nursing/nursing.module';
import { DiscountModule } from './modules/discount/discount.module';
import { ReceivablesModule } from './modules/receivables/receivables.module';
import { ClinicalSpecialtyModule } from './modules/clinical-specialty/clinical-specialty.module';
import { PatientArchivedEncounterModule } from './modules/patient-archived-encounter/patient-archived-encounter.module';
import { Icd10Module } from './modules/icd10/icd10.module';
import { QualitySafetyModule } from './modules/quality-safety/quality-safety.module';
import { CmacAnalyticsModule } from './modules/cmac-analytics/cmac-analytics.module';
import { CmdAnalyticsModule } from './modules/cmd-analytics/cmd-analytics.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TheatreModule } from './modules/theatre/theatre.module';
import { FcmModule } from './modules/fcm/fcm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    RedisModule.register(),
    PrismaModule,
    FcmModule,
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
    StaffModule,
    AuthModule,
    PatientAuthModule,
    PatientMedicalRecordsModule,
    PatientLabReportsModule,
    PatientRadiologyReportsModule,
    PatientMedicationsModule,
    PatientBillingModule,
    PatientAppointmentsModule,
    PatientFeedbackModule,
    PatientProfileModule,
    PatientFamilyModule,
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
    EncounterTemplateModule,
    LabRequestModule,
    PharmacyModule,
    WardRoundNotesModule,
    ObstetricsModule,
    LabModule,
    ChatModule,
    RadiologyModule,
    MedicationOrderModule,
    MedicationRequestModule,
    StoreModule,
    PurchasesModule,
    DialysisModule,
    BillingAnalyticsModule,
    FrontdeskModule,
    HeltyDesktopModule,
    NursesDashboardModule,
    MedicationScheduleModule,
    HmoModule,
    InpatientNursingModule,
    NursingModule,
    DiscountModule,
    ReceivablesModule,
    ClinicalSpecialtyModule,
    PatientArchivedEncounterModule,
    Icd10Module,
    QualitySafetyModule,
    CmacAnalyticsModule,
    CmdAnalyticsModule,
    AccountsModule,
    TheatreModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_GUARD, useClass: ApprovedDeviceGuard },
    { provide: APP_INTERCEPTOR, useClass: LocalTimestampInterceptor },
  ],
})
export class AppModule {}
