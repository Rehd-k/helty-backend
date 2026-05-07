import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import {
  CreateRemittanceDto,
  DiscountReceivablesQueryDto,
  HmoReceivablesQueryDto,
  ReceivablesQueryDto,
} from './dto/receivables.dto';
import { ReceivablesService } from './receivables.service';

@ApiTags('Receivables')
@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  @Get('hmo')
  @ApiOperation({ summary: 'List HMO receivables (invoice coverages)' })
  @AccountTypes('ACCOUNTING', 'BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN', 'HMO')
  listHmo(@Query() q: HmoReceivablesQueryDto) {
    return this.receivablesService.listHmoReceivables(q);
  }

  @Get('hmo/:hmoId/statement')
  @ApiOperation({ summary: 'Printable HMO receivables statement (date range)' })
  @ApiParam({ name: 'hmoId', description: 'HMO UUID' })
  @AccountTypes('ACCOUNTING', 'BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN', 'HMO')
  hmoStatement(@Param('hmoId') hmoId: string, @Query() q: ReceivablesQueryDto) {
    return this.receivablesService.hmoStatement(hmoId, q);
  }

  @Get('discount')
  @ApiOperation({ summary: 'List discount receivables (invoice coverages)' })
  @AccountTypes('ACCOUNTING', 'BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN')
  listDiscount(@Query() q: DiscountReceivablesQueryDto) {
    return this.receivablesService.listDiscountReceivables(q);
  }

  @Get('discount/owner/:staffId/statement')
  @ApiOperation({ summary: 'Printable discount receivables statement for an owner' })
  @ApiParam({ name: 'staffId', description: 'Staff UUID' })
  @AccountTypes('ACCOUNTING', 'BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN')
  discountOwnerStatement(
    @Param('staffId') staffId: string,
    @Query() q: ReceivablesQueryDto,
  ) {
    return this.receivablesService.discountOwnerStatement(staffId, q);
  }

  @Get('remittances')
  @ApiOperation({ summary: 'List coverage remittances' })
  @AccountTypes('ACCOUNTING', 'SUPER_ADMIN')
  listRemittances(@Query() q: ReceivablesQueryDto) {
    return this.receivablesService.listRemittances(q);
  }

  @Get('remittances/:id')
  @ApiOperation({ summary: 'Get one coverage remittance' })
  @ApiParam({ name: 'id', description: 'CoverageRemittance UUID' })
  @AccountTypes('ACCOUNTING', 'SUPER_ADMIN')
  getRemittance(@Param('id') id: string) {
    return this.receivablesService.getRemittance(id);
  }

  @Post('remittances')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a coverage remittance (settle receivables)' })
  @AccountTypes('ACCOUNTING', 'SUPER_ADMIN')
  createRemittance(@Body() dto: CreateRemittanceDto, @Req() req: any) {
    return this.receivablesService.createRemittance(dto, req?.user?.sub);
  }
}

