import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';

const BATCH_SIZE = 3000;

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

type DecodedCode = { code: string; desc: string };
type DecodedGroup = {
    specialty: string;
    group: string;
    range: string;
    codes: DecodedCode[];
};

function getDecodedDataPath(): string {
    const candidates = [
        path.join(__dirname, 'decoded_data.json'),
        path.resolve(process.cwd(), 'prisma', 'decoded_data.json'),
    ];
    for (const fullPath of candidates) {
        if (fs.existsSync(fullPath)) return fullPath;
    }
    throw new Error(
        `decoded_data.json not found. Looked in ${candidates.join(', ')}`,
    );
}

function flattenGroups(groups: DecodedGroup[]) {
    const rows: {
        code: string;
        description: string;
        specialty: string;
        icdGroup: string;
        range: string;
    }[] = [];

    for (const g of groups) {
        for (const c of g.codes) {
            rows.push({
                code: c.code,
                description: c.desc,
                specialty: g.specialty,
                icdGroup: g.group,
                range: g.range,
            });
        }
    }
    return rows;
}

async function main() {
    const started = Date.now();
    const dataPath = getDecodedDataPath();
    console.log(`Reading ${dataPath}...`);

    const raw = fs.readFileSync(dataPath, 'utf-8');
    const groups = JSON.parse(raw) as DecodedGroup[];
    const rows = flattenGroups(groups);

    console.log(`Flattened ${rows.length} ICD-10 codes from ${groups.length} groups.`);

    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const result = await prisma.icd10Code.createMany({
            data: batch,
            skipDuplicates: true,
        });
        inserted += result.count;
        const done = Math.min(i + BATCH_SIZE, rows.length);
        console.log(`  Batch ${done}/${rows.length} — inserted ${result.count} (total ${inserted})`);
    }

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`Done. Inserted ${inserted} new codes in ${elapsed}s.`);
}

main()
    .catch((e) => {
        console.error('ICD-10 seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
