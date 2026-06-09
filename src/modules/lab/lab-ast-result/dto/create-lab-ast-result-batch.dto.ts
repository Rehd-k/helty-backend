import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LabAstResultItemDto {
  @ApiProperty({ description: 'Configured antibiotic UUID' })
  @IsUUID()
  @IsNotEmpty()
  antibioticId: string;

  @ApiProperty({ description: 'Configured susceptibility result option UUID' })
  @IsUUID()
  @IsNotEmpty()
  resultOptionId: string;
}

export class CreateLabAstResultBatchDto {
  @ApiProperty({ description: 'Lab order item UUID' })
  @IsUUID()
  @IsNotEmpty()
  orderItemId: string;

  @ApiProperty({ description: 'Staff UUID who entered the AST results' })
  @IsUUID()
  @IsNotEmpty()
  enteredBy: string;

  @ApiProperty({
    type: [LabAstResultItemDto],
    description: 'One susceptibility result per antibiotic tested',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LabAstResultItemDto)
  results: LabAstResultItemDto[];
}
