import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import {
  CreatePatientFeedbackDto,
  ListPatientFeedbackQueryDto,
  UpdatePatientFeedbackDto,
} from './dto/patient-feedback.dto';
import { PatientFeedbackService } from './patient-feedback.service';

@ApiTags('patient-portal')
@Controller('patient')
export class PatientFeedbackController {
  constructor(
    private readonly patientFeedbackService: PatientFeedbackService,
  ) {}

  @Post('feedback')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a patient feedback submission' })
  @ApiResponse({ status: 201, description: 'Feedback created' })
  create(
    @Request() req: { user: PatientJwtPayload },
    @Body() dto: CreatePatientFeedbackDto,
  ) {
    return this.patientFeedbackService.create(req.user, dto);
  }

  @Get('feedback')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List patient feedback submissions' })
  @ApiResponse({ status: 200, description: 'Feedback list' })
  list(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: ListPatientFeedbackQueryDto,
  ) {
    return this.patientFeedbackService.list(req.user, query);
  }

  @Get('feedback/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a patient feedback submission' })
  @ApiResponse({ status: 200, description: 'Feedback detail' })
  @ApiResponse({ status: 404, description: 'Feedback not found' })
  get(@Request() req: { user: PatientJwtPayload }, @Param('id') id: string) {
    return this.patientFeedbackService.get(req.user, id);
  }

  @Patch('feedback/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an open patient feedback submission' })
  @ApiResponse({ status: 200, description: 'Feedback updated' })
  @ApiResponse({ status: 409, description: 'Feedback is no longer editable' })
  update(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdatePatientFeedbackDto,
  ) {
    return this.patientFeedbackService.update(req.user, id, dto);
  }

  @Delete('feedback/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close an open patient feedback submission' })
  @ApiResponse({ status: 200, description: 'Feedback closed' })
  @ApiResponse({ status: 409, description: 'Feedback is no longer editable' })
  remove(@Request() req: { user: PatientJwtPayload }, @Param('id') id: string) {
    return this.patientFeedbackService.remove(req.user, id);
  }
}
