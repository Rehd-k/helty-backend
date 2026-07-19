import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { PatientFamilyModule } from '../patient-family/patient-family.module';
import { PatientAppointmentsController } from './patient-appointments.controller';
import { PatientAppointmentsService } from './patient-appointments.service';

@Module({
  imports: [PrismaModule, AppointmentModule, PatientFamilyModule],
  controllers: [PatientAppointmentsController],
  providers: [PatientAppointmentsService],
})
export class PatientAppointmentsModule {}
