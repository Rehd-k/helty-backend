import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { INPATIENT_NURSING_READ_ACCESS, INPATIENT_NURSING_WRITE_ACCESS, NURSING_ASSIGNMENT_WITH_DOCTORS } from '../nursing/nursing.constants';
import { CarePlanService } from './care-plan.service';
import { CreateCarePlanDto, UpdateCarePlanDto } from './dto/nursing-docs.dto';

@ApiTags('Inpatient — care plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/care-plans')
export class CarePlanController {
  constructor(private readonly service: CarePlanService) {}

  @Get()
  @AccountTypes(...INPATIENT_NURSING_READ_ACCESS)
  @ApiOperation({ summary: 'List care plans' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...INPATIENT_NURSING_WRITE_ACCESS)
  @ApiOperation({ summary: 'Create care plan' })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateCarePlanDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub);
  }

  @Patch(':carePlanId')
  @AccountTypes(...INPATIENT_NURSING_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update own care plan' })
  update(
    @Param('admissionId') admissionId: string,
    @Param('carePlanId') carePlanId: string,
    @Body() dto: UpdateCarePlanDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.update(admissionId, carePlanId, dto, req.user.sub);
  }
}
