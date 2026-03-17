import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PurchaseNoteStatus } from '@prisma/client';

export class UpdatePurchaseNoteStatusDto {
  @ApiProperty({ enum: PurchaseNoteStatus })
  @IsEnum(PurchaseNoteStatus)
  status: PurchaseNoteStatus;

  @ApiPropertyOptional({
    description: 'Required when status is COMPLETED: store location to receive items into',
  })
  @IsOptional()
  @IsUUID()
  toLocationId?: string;
}
