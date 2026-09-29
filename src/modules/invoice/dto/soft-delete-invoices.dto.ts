import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class SoftDeleteInvoicesDto {
  @ApiProperty({
    type: [String],
    description: 'Invoice UUIDs to soft-delete. Payment rows on the same invoice are deduped by the client.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  invoiceIds!: string[];
}
