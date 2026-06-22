import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { CLINICAL_READ_ACCESS } from '../../common/constants/clinical-access.constants';
import { RADIOLOGY_PROCEDURE_WRITE_ACCESS } from './radiology.constants';
import { RadiologyProcedureService } from './radiology-procedure.service';
import {
  CreateRadiologyProcedureDto,
  UpdateRadiologyProcedureDto,
} from './dto/radiology-procedure.dto';

@ApiTags('Radiology – Procedure')
@Controller('radiology/order-items/:orderItemId/procedure')
@UseGuards(JwtAuthGuard, AccessGuard)
export class RadiologyProcedureController {
  constructor(
    private readonly radiologyProcedureService: RadiologyProcedureService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...RADIOLOGY_PROCEDURE_WRITE_ACCESS)
  @ApiOperation({
    summary: 'Record imaging procedure (scan start) for an order item',
  })
  create(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: CreateRadiologyProcedureDto,
  ) {
    return this.radiologyProcedureService.create(orderItemId, dto);
  }

  @Patch()
  @AccountTypes(...RADIOLOGY_PROCEDURE_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update procedure (e.g. end time, notes)' })
  update(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: UpdateRadiologyProcedureDto,
  ) {
    return this.radiologyProcedureService.update(orderItemId, dto);
  }

  @Get()
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get procedure record for an order item' })
  getProcedure(@Param('orderItemId') orderItemId: string) {
    return this.radiologyProcedureService.getByOrderItemId(orderItemId);
  }
}
