import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLabResultDto {
  @ApiProperty({ description: 'Lab order item UUID' })
  @IsUUID()
  @IsNotEmpty()
  orderItemId: string;

  @ApiProperty({ description: 'Lab test field UUID (must belong to order item test version)' })
  @IsUUID()
  @IsNotEmpty()
  fieldId: string;

  @ApiProperty({ description: 'Result value (stored as string)' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({ description: 'Staff UUID who entered the result' })
  @IsUUID()
  @IsNotEmpty()
  enteredBy: string;
}
