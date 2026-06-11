import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import {
  INPATIENT_NURSING_READ_ACCESS,
  NURSING_ASSIGNMENT_WITH_DOCTORS,
} from '../nursing/nursing.constants';
import { NurseAssignmentService } from './nurse-assignment.service';
import { CreateNurseAssignmentDto } from './dto/nurse-assignment.dto';

@ApiTags('Inpatient — nurse assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/nurse-assignments')
export class NurseAssignmentController {
  constructor(private readonly service: NurseAssignmentService) {}

  @Get()
  @AccountTypes(...INPATIENT_NURSING_READ_ACCESS)
  @ApiOperation({ summary: 'List nurse assignments for an admission' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...NURSING_ASSIGNMENT_WITH_DOCTORS)
  @ApiOperation({
    summary:
      'Assign a nurse to an admission (shift); body includes target nurseId',
  })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateNurseAssignmentDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub);
  }

  @Delete(':assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes(...NURSING_ASSIGNMENT_WITH_DOCTORS)
  @ApiOperation({ summary: 'Remove a nurse assignment' })
  async remove(
    @Param('admissionId') admissionId: string,
    @Param('assignmentId') assignmentId: string,
    @Req() req: { user: { sub: string } },
  ) {
    await this.service.remove(admissionId, assignmentId, req.user.sub);
  }
}
