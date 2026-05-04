import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { StaffConversationMessageType } from '@prisma/client';

export class SendConversationMessageRestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: StaffConversationMessageType })
  @IsOptional()
  @IsEnum(StaffConversationMessageType)
  type?: StaffConversationMessageType;

  @ApiPropertyOptional({
    description:
      'Relative path from upload endpoint (e.g. chat/{convId}/file.png)',
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;
}
