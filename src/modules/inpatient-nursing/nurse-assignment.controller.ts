import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { NurseAssignmentService } from './nurse-assignment.service';
import { CreateNurseAssignmentDto } from './dto/nurse-assignment.dto';

@ApiTags('Inpatient — nurse assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/nurse-assignments')
export class NurseAssignmentController {
  constructor(private readonly service: NurseAssignmentService) {}

  @Get()
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'List nurse assignments for an admission' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({
    summary:
      'Assign a nurse to an admission (shift); body includes target nurseId',
  })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateNurseAssignmentDto,
  ) {
    return this.service.create(admissionId, dto);
  }

  @Delete(':assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes('HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'Remove a nurse assignment' })
  async remove(
    @Param('admissionId') admissionId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    await this.service.remove(admissionId, assignmentId);
  }
}
