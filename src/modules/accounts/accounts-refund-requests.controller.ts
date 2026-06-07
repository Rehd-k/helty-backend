import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { ACCOUNT_HEAD_ACCESS } from './accounts.constants';
import {
  RejectInvoiceItemRefundDto,
  ReviewInvoiceItemRefundDto,
} from '../invoice/dto/invoice.dto';
import { InvoiceItemRefundService } from '../invoice/invoice-item-refund.service';

@ApiTags('Accounts - Refund Requests')
@Controller('accounts/refund-requests')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...ACCOUNT_HEAD_ACCESS)
export class AccountsRefundRequestsController {
  constructor(private readonly service: InvoiceItemRefundService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Pending invoice line refund requests' })
  pending() {
    return this.service.listPending();
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve and execute an invoice line refund' })
  approve(
    @Param('id') id: string,
    @Body() _dto: ReviewInvoiceItemRefundDto,
    @Req() req: { user?: { sub?: string; staffRole?: string } },
  ) {
    return this.service.approve(id, req.user?.sub ?? '', req.user?.staffRole);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject an invoice line refund request' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectInvoiceItemRefundDto,
    @Req() req: { user?: { sub?: string; staffRole?: string } },
  ) {
    return this.service.reject(
      id,
      dto.reason,
      req.user?.sub ?? '',
      req.user?.staffRole,
    );
  }
}
