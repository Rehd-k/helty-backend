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
import { RadiologyProcedureService } from './radiology-procedure.service';
import {
  CreateRadiologyProcedureDto,
  UpdateRadiologyProcedureDto,
} from './dto/radiology-procedure.dto';

@ApiTags('Radiology – Procedure')
@Controller('radiology/requests/:requestId/procedure')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('RADIOGRAPHER', 'RADIOLOGY')
export class RadiologyProcedureController {
  constructor(
    private readonly radiologyProcedureService: RadiologyProcedureService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record imaging procedure (scan start)' })
  create(
    @Param('requestId') requestId: string,
    @Body() dto: CreateRadiologyProcedureDto,
  ) {
    return this.radiologyProcedureService.create(requestId, dto);
  }

  @Patch()
  @ApiOperation({ summary: 'Update procedure (e.g. end time, notes)' })
  update(
    @Param('requestId') requestId: string,
    @Body() dto: UpdateRadiologyProcedureDto,
  ) {
    return this.radiologyProcedureService.update(requestId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get procedure record for a request' })
  getProcedure(@Param('requestId') requestId: string) {
    return this.radiologyProcedureService.getByRequestId(requestId);
  }
}
