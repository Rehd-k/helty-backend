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
import { IvFluidOrderService } from './iv-fluid-order.service';
import { CreateIvFluidOrderDto, UpdateIvFluidOrderDto } from './dto/iv.dto';

@ApiTags('Inpatient — IV fluid orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/iv-fluid-orders')
export class IvFluidOrderController {
  constructor(private readonly service: IvFluidOrderService) {}

  @Get()
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'List IV fluid orders for an admission' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('INPATIENT_DOCTOR', 'CONSULTANT', 'HEAD_NURSE')
  @ApiOperation({ summary: 'Create IV fluid order (ordering clinician from JWT)' })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateIvFluidOrderDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub);
  }

  @Patch(':orderId')
  @AccountTypes('INPATIENT_DOCTOR', 'CONSULTANT', 'HEAD_NURSE', 'NURSE')
  @ApiOperation({ summary: 'Update IV fluid order (status/rate/end)' })
  update(
    @Param('admissionId') admissionId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateIvFluidOrderDto,
  ) {
    return this.service.update(admissionId, orderId, dto);
  }
}
