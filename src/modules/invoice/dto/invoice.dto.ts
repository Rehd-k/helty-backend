import {
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsUUID,
    Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TransactionStatus } from '@prisma/client';

// ─── Invoice DTOs ──────────────────────────────────────────────────────────────

export class CreateInvoiceDto {
    @ApiProperty({
        description: 'UUID of the patient this invoice belongs to',
        example: 'a1b2c3d4-…',
    })
    @IsUUID()
    @IsNotEmpty()
    patientId: string;

    @ApiProperty({
        enum: TransactionStatus,
        description: 'Initial status of the invoice',
        example: TransactionStatus.DRAFT,
    })
    @IsEnum(TransactionStatus)
    status: TransactionStatus;

    @ApiPropertyOptional({
        description: 'UUID of a staff member to associate with this invoice',
        example: 'uuid-here',
    })
    @IsUUID()
    @IsOptional()
    staffId?: string;
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) { }

// ─── InvoiceItem DTOs ──────────────────────────────────────────────────────────

export class AddInvoiceItemDto {
    @ApiProperty({
        description: 'UUID of the service to add as a line item',
        example: 'uuid-here',
    })
    @IsUUID()
    @IsNotEmpty()
    serviceId: string;

    @ApiPropertyOptional({
        description: 'Quantity of the service rendered',
        example: 1,
        default: 1,
    })
    @IsInt()
    @IsPositive()
    @IsOptional()
    quantity?: number;

    @ApiProperty({
        description:
            'Price snapshot at the time of invoicing — independent of future service cost changes',
        example: 3500,
    })
    @IsNumber()
    @Min(0)
    priceAtTime: number;
}

export class UpdateInvoiceItemDto {
    @ApiPropertyOptional({ description: 'Updated quantity', example: 2 })
    @IsInt()
    @IsPositive()
    @IsOptional()
    quantity?: number;

    @ApiPropertyOptional({
        description: 'Corrected price snapshot',
        example: 3200,
    })
    @IsNumber()
    @Min(0)
    @IsOptional()
    priceAtTime?: number;
}
