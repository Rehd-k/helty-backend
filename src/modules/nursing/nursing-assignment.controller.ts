import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import {
  NURSING_ACCESS,
  NURSING_ASSIGNMENT_ADMIN,
} from './nursing.constants';
import { InpatientNurseAssignmentListService } from './inpatient-nurse-assignment-list.service';
import { OutpatientNurseAssignmentService } from './outpatient-nurse-assignment.service';
import { QueryInpatientNurseAssignmentDto } from './dto/inpatient-assignment-query.dto';
import {
  CreateOutpatientNurseAssignmentDto,
  QueryOutpatientNurseAssignmentDto,
} from './dto/outpatient-assignment.dto';

@ApiTags('Nursing — patient assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('nursing/assignments')
export class NursingAssignmentController {
  constructor(
    private readonly inpatientList: InpatientNurseAssignmentListService,
    private readonly outpatient: OutpatientNurseAssignmentService,
  ) {}

  @Get('inpatient')
  @AccountTypes(...NURSING_ASSIGNMENT_ADMIN)
  @ApiOperation({ summary: 'List inpatient nurse assignments (matron/charge)' })
  listInpatient(
    @Query() query: QueryInpatientNurseAssignmentDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.inpatientList.list(req.user.sub, query);
  }

  @Get('outpatient')
  @AccountTypes(...NURSING_ACCESS)
  @ApiOperation({ summary: 'List outpatient nurse-to-queue assignments' })
  listOutpatient(
    @Query() query: QueryOutpatientNurseAssignmentDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.outpatient.list(req.user.sub, query);
  }

  @Post('outpatient')
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...NURSING_ASSIGNMENT_ADMIN)
  @ApiOperation({ summary: 'Assign nurse to OPD/O&G queue patient' })
  createOutpatient(
    @Body() dto: CreateOutpatientNurseAssignmentDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.outpatient.create(req.user.sub, dto);
  }

  @Delete('outpatient/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes(...NURSING_ASSIGNMENT_ADMIN)
  @ApiOperation({ summary: 'Remove outpatient nurse assignment' })
  async removeOutpatient(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    await this.outpatient.remove(req.user.sub, id);
  }
}
