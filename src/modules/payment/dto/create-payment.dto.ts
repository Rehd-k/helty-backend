import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  INSURANCE = 'insurance',
  CHEQUE = 'cheque',
}

export class CreatePaymentDto {
  @IsString()
  patientId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMethod)
  method: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePaymentDto {
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  amount?: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
