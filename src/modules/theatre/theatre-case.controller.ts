import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import {
  THEATRE_BILLING_ACCESS,
  THEATRE_CASE_READ_ACCESS,
  THEATRE_CLINICAL_ACCESS,
  OPERATIVE_NOTE_WRITE_ACCESS,
} from './theatre.constants';
import { TheatreCaseService } from './theatre-case.service';
import { SurgeryRequestService } from './surgery-request.service';
import {
  AddCaseConsumableDto,
  BillSurgeryDto,
  TransferAfterSurgeryDto,
  UpdateTheatreCaseDto,
  UpsertTheatreOperativeNoteDto,
} from './dto/theatre.dto';

type ReqUser = { user: { sub: string } };

@ApiTags('Theatre – Cases')
@Controller('theatre/cases')
@UseGuards(JwtAuthGuard, AccessGuard)
export class TheatreCaseController {
  constructor(
    private readonly theatreCaseService: TheatreCaseService,
    private readonly surgeryRequestService: SurgeryRequestService,
  ) {}

  @Get(':surgeryRequestId')
  @AccountTypes(...THEATRE_CASE_READ_ACCESS)
  @ApiOperation({ summary: 'Get surgery request with case details' })
  findOne(@Param('surgeryRequestId') surgeryRequestId: string) {
    return this.surgeryRequestService.findOne(surgeryRequestId);
  }

  @Get(':surgeryRequestId/operative-notes')
  @AccountTypes(...THEATRE_CASE_READ_ACCESS)
  @ApiOperation({ summary: 'List structured operative notes for a case' })
  listOperativeNotes(@Param('surgeryRequestId') surgeryRequestId: string) {
    return this.theatreCaseService.listOperativeNotes(surgeryRequestId);
  }

  @Post(':surgeryRequestId/operative-notes')
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...OPERATIVE_NOTE_WRITE_ACCESS)
  @ApiOperation({ summary: 'Add a structured operative note' })
  createOperativeNote(
    @Param('surgeryRequestId') surgeryRequestId: string,
    @Body() dto: UpsertTheatreOperativeNoteDto,
    @Req() req: ReqUser,
  ) {
    return this.theatreCaseService.createOperativeNote(
      surgeryRequestId,
      dto,
      req.user.sub,
    );
  }

  @Patch(':surgeryRequestId/operative-notes/:noteId')
  @AccountTypes(...OPERATIVE_NOTE_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update a structured operative note' })
  updateOperativeNote(
    @Param('surgeryRequestId') surgeryRequestId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpsertTheatreOperativeNoteDto,
    @Req() req: ReqUser,
  ) {
    return this.theatreCaseService.updateOperativeNote(
      surgeryRequestId,
      noteId,
      dto,
      req.user.sub,
    );
  }

  @Post(':surgeryRequestId/start')
  @HttpCode(HttpStatus.OK)
  @AccountTypes(...THEATRE_CLINICAL_ACCESS)
  @ApiOperation({ summary: 'Start surgery (IN_PROGRESS)' })
  start(
    @Param('surgeryRequestId') surgeryRequestId: string,
    @Req() req: ReqUser,
  ) {
    return this.theatreCaseService.start(surgeryRequestId, req.user.sub);
  }

  @Patch(':surgeryRequestId')
  @AccountTypes(...THEATRE_CLINICAL_ACCESS)
  @ApiOperation({ summary: 'Update operative notes, findings, and team' })
  update(
    @Param('surgeryRequestId') surgeryRequestId: string,
    @Body() dto: UpdateTheatreCaseDto,
  ) {
    return this.theatreCaseService.update(surgeryRequestId, dto);
  }

  @Post(':surgeryRequestId/complete')
  @HttpCode(HttpStatus.OK)
  @AccountTypes(...THEATRE_CLINICAL_ACCESS)
  @ApiOperation({ summary: 'Complete surgery' })
  complete(@Param('surgeryRequestId') surgeryRequestId: string) {
    return this.theatreCaseService.complete(surgeryRequestId);
  }

  @Post(':surgeryRequestId/consumables')
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...THEATRE_CLINICAL_ACCESS)
  @ApiOperation({ summary: 'Record consumable used during surgery' })
  addConsumable(
    @Param('surgeryRequestId') surgeryRequestId: string,
    @Body() dto: AddCaseConsumableDto,
    @Req() req: ReqUser,
  ) {
    return this.theatreCaseService.addConsumable(
      surgeryRequestId,
      dto,
      req.user.sub,
    );
  }

  @Delete(':surgeryRequestId/consumables/:consumableLineId')
  @AccountTypes(...THEATRE_CLINICAL_ACCESS)
  @ApiOperation({ summary: 'Remove unbilled consumable line' })
  removeConsumable(
    @Param('surgeryRequestId') surgeryRequestId: string,
    @Param('consumableLineId') consumableLineId: string,
  ) {
    return this.theatreCaseService.removeConsumable(
      surgeryRequestId,
      consumableLineId,
    );
  }

  @Post(':surgeryRequestId/bill')
  @HttpCode(HttpStatus.OK)
  @AccountTypes(...THEATRE_BILLING_ACCESS)
  @ApiOperation({ summary: 'Send surgery service and consumables to billing' })
  bill(
    @Param('surgeryRequestId') surgeryRequestId: string,
    @Body() dto: BillSurgeryDto,
    @Req() req: ReqUser,
  ) {
    return this.theatreCaseService.bill(
      surgeryRequestId,
      dto,
      req.user.sub,
    );
  }

  @Post(':surgeryRequestId/transfer')
  @HttpCode(HttpStatus.OK)
  @AccountTypes(...THEATRE_CLINICAL_ACCESS)
  @ApiOperation({ summary: 'Transfer patient to recovery ward or bed' })
  transfer(
    @Param('surgeryRequestId') surgeryRequestId: string,
    @Body() dto: TransferAfterSurgeryDto,
    @Req() req: ReqUser,
  ) {
    return this.theatreCaseService.transfer(
      surgeryRequestId,
      dto,
      req.user.sub,
    );
  }
}
