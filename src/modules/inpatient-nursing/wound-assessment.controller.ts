import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { WoundAssessmentService } from './wound-assessment.service';
import { CreateWoundAssessmentDto } from './dto/nursing-docs.dto';

@ApiTags('Inpatient — wound assessments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/wound-assessments')
export class WoundAssessmentController {
  constructor(private readonly service: WoundAssessmentService) {}

  @Get()
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'List wound assessments' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('NURSE', 'HEAD_NURSE')
  @ApiOperation({ summary: 'Create wound assessment' })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateWoundAssessmentDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub);
  }
}
