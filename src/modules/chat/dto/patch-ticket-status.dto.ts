import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SupportTicketStatus } from '@prisma/client';

export class PatchTicketStatusDto {
  @ApiProperty({ enum: SupportTicketStatus })
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;
}
