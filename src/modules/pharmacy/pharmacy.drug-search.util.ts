import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DrugSearchSortField } from './dto/search-drug.dto';

export const DRUG_SEARCH_DB_SORT_FIELDS = [
  'createdAt',
  'genericName',
  'brandName',
] as const;

export type DrugSearchDbSortField = (typeof DRUG_SEARCH_DB_SORT_FIELDS)[number];

export const DRUG_SEARCH_COMPUTED_SORT_FIELDS = [
  'quantity',
  'sellingPrice',
  'expiryDate',
] as const;

export type DrugSearchCursor = {
  id: string;
  createdAt: Date;
  sortValue?: string;
};

export function isDrugSearchDbSort(
  sortBy?: DrugSearchSortField,
): sortBy is DrugSearchDbSortField {
  return (
    sortBy === 'createdAt' ||
    sortBy === 'genericName' ||
    sortBy === 'brandName'
  );
}

export function isDrugSearchComputedSort(
  sortBy?: DrugSearchSortField,
): boolean {
  return (
    sortBy === 'quantity' ||
    sortBy === 'sellingPrice' ||
    sortBy === 'expiryDate'
  );
}

export function resolveDrugSearchDbSort(
  sortBy?: DrugSearchSortField,
): DrugSearchDbSortField {
  if (isDrugSearchDbSort(sortBy)) return sortBy;
  return 'createdAt';
}

export function hasNumberFilter(value?: string): value is string {
  return value != null && value !== '';
}

export function appendDrugSearchCursor(
  where: Prisma.DrugWhereInput,
  options: {
    cursorId: string;
    cursorCreatedAt: Date;
    cursorSortValue?: string;
    dbSortBy: DrugSearchDbSortField;
    sortOrder: 'asc' | 'desc';
  },
): void {
  const op = options.sortOrder === 'desc' ? 'lt' : 'gt';

  let cursorClause: Prisma.DrugWhereInput;

  if (options.dbSortBy === 'createdAt') {
    cursorClause = {
      OR: [
        { createdAt: { [op]: options.cursorCreatedAt } },
        {
          AND: [
            { createdAt: options.cursorCreatedAt },
            { id: { [op]: options.cursorId } },
          ],
        },
      ],
    };
  } else {
    const sortValue = options.cursorSortValue;
    if (sortValue == null || sortValue === '') {
      throw new BadRequestException(
        `cursorSortValue is required when sortBy is "${options.dbSortBy}".`,
      );
    }
    const field = options.dbSortBy;
    cursorClause = {
      OR: [
        { [field]: { [op]: sortValue, mode: 'insensitive' } },
        {
          AND: [
            { [field]: { equals: sortValue, mode: 'insensitive' } },
            { createdAt: { [op]: options.cursorCreatedAt } },
          ],
        },
        {
          AND: [
            { [field]: { equals: sortValue, mode: 'insensitive' } },
            { createdAt: options.cursorCreatedAt },
            { id: { [op]: options.cursorId } },
          ],
        },
      ],
    };
  }

  const existingAnd = where.AND;
  const andList = Array.isArray(existingAnd)
    ? [...existingAnd]
    : existingAnd
      ? [existingAnd]
      : [];
  andList.push(cursorClause);
  where.AND = andList;
}

export function buildDrugSearchOrderBy(
  dbSortBy: DrugSearchDbSortField,
  sortOrder: 'asc' | 'desc',
): Prisma.DrugOrderByWithRelationInput[] {
  return [
    { [dbSortBy]: sortOrder },
    { createdAt: sortOrder },
    { id: sortOrder },
  ];
}

export function buildDrugSearchCursor(
  drug: {
    id: string;
    createdAt: Date;
    genericName: string;
    brandName: string;
  },
  dbSortBy: DrugSearchDbSortField,
): DrugSearchCursor {
  const cursor: DrugSearchCursor = {
    id: drug.id,
    createdAt: drug.createdAt,
  };
  if (dbSortBy === 'genericName') {
    cursor.sortValue = drug.genericName;
  } else if (dbSortBy === 'brandName') {
    cursor.sortValue = drug.brandName;
  }
  return cursor;
}

type SellableBatch = {
  quantityRemaining: number;
  sellingPrice: Prisma.Decimal;
  expiryDate: Date;
  createdAt: Date;
};

export function summarizeDrugBatches(batches: SellableBatch[]) {
  const quantity = batches.reduce(
    (sum, b) => sum + (b.quantityRemaining ?? 0),
    0,
  );
  const fifoBatch = batches.length
    ? batches.reduce((earliest, b) =>
        new Date(b.expiryDate) < new Date(earliest.expiryDate) ? b : earliest,
      )
    : null;
  const sellingPrice = fifoBatch?.sellingPrice ?? null;
  const expiryDate = fifoBatch?.expiryDate ?? null;
  return { quantity, sellingPrice, expiryDate };
}

export function sortDrugSearchPage<
  T extends {
    quantity: number;
    sellingPrice: unknown;
    expiryDate: Date | null;
  },
>(items: T[], sortBy: DrugSearchSortField, sortOrder: 'asc' | 'desc'): T[] {
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (sortBy === 'quantity') {
      return (a.quantity - b.quantity) * dir;
    }
    if (sortBy === 'sellingPrice') {
      const av =
        a.sellingPrice != null ? Number(a.sellingPrice) : Number.NEGATIVE_INFINITY;
      const bv =
        b.sellingPrice != null ? Number(b.sellingPrice) : Number.NEGATIVE_INFINITY;
      return (av - bv) * dir;
    }
    if (sortBy === 'expiryDate') {
      const av = a.expiryDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bv = b.expiryDate?.getTime() ?? Number.POSITIVE_INFINITY;
      return (av - bv) * dir;
    }
    return 0;
  });
}
