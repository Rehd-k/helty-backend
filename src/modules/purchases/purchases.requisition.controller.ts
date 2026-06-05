import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { PURCHASES_ACCESS } from './purchases.constants';
import { PurchasesRequisitionService } from './purchases.requisition.service';
import {
  ConvertRequisitionToPoDto,
  CreateRequisitionDto,
  ListRequisitionDto,
  RejectRequisitionDto,
} from './dto/requisition.dto';

type ReqUser = { user: { sub: string; staffRole?: string } };

@ApiTags('Purchases - Requisitions')
@Controller('purchases/requisitions')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PurchasesRequisitionController {
  constructor(private readonly service: PurchasesRequisitionService) {}

  @Post()
  @ApiOperation({
    summary: 'Create requisition (any authenticated department staff)',
  })
  create(@Body() dto: CreateRequisitionDto, @Req() req: ReqUser) {
    return this.service.create(dto, req.user.sub);
  }

  @Get()
  @AccountTypes(...PURCHASES_ACCESS)
  findAll(@Query() query: ListRequisitionDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @AccountTypes(...PURCHASES_ACCESS)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/approve')
  @AccountTypes(...PURCHASES_ACCESS)
  approve(@Param('id') id: string, @Req() req: ReqUser) {
    return this.service.approve(id, req.user.sub, req.user.staffRole);
  }

  @Post(':id/reject')
  @AccountTypes(...PURCHASES_ACCESS)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectRequisitionDto,
    @Req() req: ReqUser,
  ) {
    return this.service.reject(id, dto, req.user.sub, req.user.staffRole);
  }

  @Post(':id/convert-to-po')
  @AccountTypes(...PURCHASES_ACCESS)
  convertToPo(
    @Param('id') id: string,
    @Body() dto: ConvertRequisitionToPoDto,
    @Req() req: ReqUser,
  ) {
    return this.service.convertToPo(
      id,
      dto,
      req.user.sub,
      req.user.staffRole,
    );
  }
}
