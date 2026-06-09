import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const STAFF_ID = process.env.SEED_STAFF_ID ?? 'c59d31d7-b40c-425b-b1f9-c733fa0d5f02';

function withLagosTimezone(connectionString: string): string {
    try {
        const url = new URL(connectionString);
        const existingOptions = url.searchParams.get('options');
        if (existingOptions?.includes('timezone=')) {
            return connectionString;
        }

        const lagosTimezoneOption = '-c timezone=Africa/Lagos';
        url.searchParams.set(
            'options',
            existingOptions ? `${existingOptions} ${lagosTimezoneOption}` : lagosTimezoneOption,
        );
        return url.toString();
    } catch {
        return connectionString;
    }
}

const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: withLagosTimezone(process.env.DATABASE_URL!),
    }),
});

function readCsvData(filePath: string) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
}

function getSeedCsvPath(fileName: string): string {
    const configuredDir = process.env.SEED_DATA_DIR ? path.resolve(process.env.SEED_DATA_DIR) : null;
    const candidateDirs = [
        ...(configuredDir ? [configuredDir] : [__dirname]),
        path.resolve(process.cwd(), 'prisma'),
    ];

    for (const dir of candidateDirs) {
        const fullPath = path.join(dir, fileName);
        if (fs.existsSync(fullPath)) return fullPath;
    }

    throw new Error(
        `Seed file not found: ${fileName}. Looked in ${candidateDirs.join(' , ')}. ` +
        `If you keep seed data elsewhere, set SEED_DATA_DIR to that folder.`,
    );
}

function parseIntOrZero(value: unknown): number {
    const n = parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(n) ? n : 0;
}

function parsePrice(value: unknown): Prisma.Decimal {
    const n = parseFloat(String(value ?? '0').replace(/[₦,\s]/g, ''));
    return new Prisma.Decimal(Number.isFinite(n) ? n : 0);
}

async function main() {
    const started = Date.now();
    const csvPath = getSeedCsvPath('CONSUMABLE_PRICE_LIST.csv');
    console.log(`Reading ${csvPath}...`);

    const staff = await prisma.staff.findUnique({ where: { id: STAFF_ID } });
    if (!staff) {
        throw new Error(
            `Seed staff "${STAFF_ID}" not found. Create this staff record before running the purchase-item seed ` +
            `(or set SEED_STAFF_ID to an existing staff UUID).`,
        );
    }

    const rawRows = readCsvData(csvPath) as Record<string, unknown>[];
    console.log(`Parsed ${rawRows.length} CSV rows.`);

    const existingItems = await prisma.purchaseItem.findMany({
        where: { deletedAt: null },
        select: { itemName: true },
    });
    const existingNames = new Set(
        existingItems.map((item) => item.itemName.trim().toLowerCase()),
    );

    let skippedInvalid = 0;
    let skippedDuplicate = 0;
    const toInsert: Prisma.PurchaseItemCreateManyInput[] = [];

    for (const row of rawRows) {
        const itemName = String(row['Item Name'] ?? '').trim();
        if (!itemName) {
            skippedInvalid++;
            continue;
        }

        const normalized = itemName.toLowerCase();
        if (existingNames.has(normalized)) {
            skippedDuplicate++;
            continue;
        }

        existingNames.add(normalized);
        toInsert.push({
            itemName,
            category: String(row['Category'] ?? '').trim() || null,
            description: String(row['Description'] ?? '').trim() || null,
            reorderLevel: parseIntOrZero(row['Reorder Level']),
            reorderQuantity: parseIntOrZero(row['Reorder Quantity']),
            sellingPrice: parsePrice(row['Selling Price (NGN)']),
            createdById: STAFF_ID,
            updatedById: STAFF_ID,
        });
    }

    const result = await prisma.purchaseItem.createMany({ data: toInsert });
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);

    console.log(`Skipped ${skippedInvalid} invalid row(s).`);
    console.log(`Skipped ${skippedDuplicate} duplicate item(s).`);
    console.log(`Inserted ${result.count} purchase item(s) in ${elapsed}s.`);
}

main()
    .catch((e) => {
        console.error('Purchase item seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
