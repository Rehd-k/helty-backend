import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import {
  DIALYSIS_ACCESS,
  DIALYSIS_CLINICAL_ACCESS,
  DIALYSIS_READ_ACCESS,
} from './dialysis.constants';
import { DialysisSessionService } from './dialysis-session.service';
import { CreateDialysisSessionDto } from './dto/create-dialysis-session.dto';
import { UpdateDialysisSessionDto } from './dto/update-dialysis-session.dto';
import { ListDialysisSessionsQueryDto } from './dto/list-dialysis-sessions-query.dto';
import { AddSessionConsumableDto } from './dto/add-session-consumable.dto';

type ReqUser = {
  user: { sub: string; staffRole?: string; accountType?: string };
};

@ApiTags('Dialysis – Sessions')
@Controller('dialysis/sessions')
@UseGuards(JwtAuthGuard, AccessGuard)
export class DialysisSessionController {
  constructor(private readonly dialysisSessionService: DialysisSessionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...DIALYSIS_ACCESS)
  @ApiOperation({ summary: 'Create a dialysis session' })
  create(@Body() dto: CreateDialysisSessionDto) {
    return this.dialysisSessionService.create(dto);
  }

  @Get()
  @AccountTypes(...DIALYSIS_READ_ACCESS)
  @ApiOperation({ summary: 'List dialysis sessions with optional filters' })
  findAll(@Query() query: ListDialysisSessionsQueryDto) {
    return this.dialysisSessionService.findAll(query);
  }

  @Get(':id')
  @AccountTypes(...DIALYSIS_READ_ACCESS)
  @ApiOperation({
    summary: 'Get dialysis session by ID including consumables',
  })
  findOne(@Param('id') id: string) {
    return this.dialysisSessionService.findOne(id);
  }

  @Patch(':id')
  @AccountTypes(...DIALYSIS_CLINICAL_ACCESS)
  @ApiOperation({ summary: 'Update dialysis session (start, complete, cancel)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDialysisSessionDto,
    @Req() req: ReqUser,
  ) {
    return this.dialysisSessionService.update(
      id,
      dto,
      req.user.sub,
      req.user.staffRole,
    );
  }

  @Post(':id/consumables')
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...DIALYSIS_CLINICAL_ACCESS)
  @ApiOperation({
    summary: 'Add a consumable to the session, deduct stock, and bill patient',
  })
  addConsumable(
    @Param('id') id: string,
    @Body() dto: AddSessionConsumableDto,
    @Req() req: ReqUser,
  ) {
    return this.dialysisSessionService.addConsumable(id, dto, req.user.sub);
  }
}
