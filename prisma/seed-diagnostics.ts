/**
 * Diagnostics customer bootstrap seed.
 *
 * Creates:
 * 1. First SUPER_ADMIN staff (no hospital STAFF_ID dependency)
 * 2. Minimal departments / categories / lab+radiology services
 *
 * Does NOT import pharmacy formulary or IMSH hospital price lists.
 *
 * Env:
 *   DATABASE_URL (required)
 *   SEED_ADMIN_EMAIL (default: admin@diagnostics.local)
 *   SEED_ADMIN_PASSWORD (default: ChangeMeNow! — override in production)
 *   SEED_ADMIN_STAFF_ID (default: DIAG-ADMIN-001)
 *   SEED_ADMIN_FIRST_NAME / SEED_ADMIN_LAST_NAME
 *   SEED_DATA_DIR (default: prisma/seeds/diagnostics)
 */
import { PrismaClient, AccountType, StaffRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';

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
      existingOptions
        ? `${existingOptions} ${lagosTimezoneOption}`
        : lagosTimezoneOption,
    );
    return url.toString();
  } catch {
    return connectionString;
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for seed:diagnostics');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: withLagosTimezone(databaseUrl),
  }),
});

function readCsvData(filePath: string) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
}

function diagnosticsSeedDir(): string {
  if (process.env.SEED_DATA_DIR) {
    return path.resolve(process.env.SEED_DATA_DIR);
  }
  const nextToScript = path.join(__dirname, 'seeds', 'diagnostics');
  if (fs.existsSync(nextToScript)) return nextToScript;
  return path.resolve(process.cwd(), 'prisma', 'seeds', 'diagnostics');
}

function requireCsv(fileName: string): string {
  const fullPath = path.join(diagnosticsSeedDir(), fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `Diagnostics seed file not found: ${fullPath}. ` +
        `Set SEED_DATA_DIR or ensure prisma/seeds/diagnostics exists.`,
    );
  }
  return fullPath;
}

async function ensureAdminStaff() {
  const email = (
    process.env.SEED_ADMIN_EMAIL ?? 'admin@diagnostics.local'
  ).trim();
  const passwordPlain =
    process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMeNow!';
  const staffId = (process.env.SEED_ADMIN_STAFF_ID ?? 'DIAG-ADMIN-001').trim();
  const firstName = (process.env.SEED_ADMIN_FIRST_NAME ?? 'Diagnostics').trim();
  const lastName = (process.env.SEED_ADMIN_LAST_NAME ?? 'Admin').trim();

  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.SEED_ADMIN_PASSWORD ||
      process.env.SEED_ADMIN_PASSWORD === 'ChangeMeNow!')
  ) {
    console.warn(
      'WARNING: Using default SEED_ADMIN_PASSWORD in production. ' +
        'Set SEED_ADMIN_PASSWORD before seeding a real customer.',
    );
  }

  const existing = await prisma.staff.findFirst({
    where: {
      OR: [{ email }, { staffId }],
    },
  });
  if (existing) {
    console.log(`Admin staff already present (${existing.staffId}); skipping create.`);
    return existing;
  }

  const password = await bcrypt.hash(passwordPlain, 10);
  const admin = await prisma.staff.create({
    data: {
      staffId,
      firstName,
      lastName,
      email,
      password,
      accountType: AccountType.SUPER_ADMIN,
      staffRole: StaffRole.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`Created SUPER_ADMIN ${admin.staffId} <${email}>`);
  return admin;
}

async function main() {
  console.log('Diagnostics seed starting...');
  console.log(`SEED_DATA_DIR=${diagnosticsSeedDir()}`);

  const admin = await ensureAdminStaff();

  console.log('Seeding departments...');
  const rawDepartments = readCsvData(requireCsv('REF_Departments.csv'));
  await prisma.department.createMany({
    data: rawDepartments.map((row: any) => ({
      name: String(row['Department']).trim(),
      createdById: admin.id,
    })),
    skipDuplicates: true,
  });

  console.log('Seeding categories...');
  const rawCategories = readCsvData(requireCsv('REF_Categories.csv'));
  await prisma.serviceCategory.createMany({
    data: rawCategories.map((row: any) => ({
      name: String(row['Category']).trim(),
      createdById: admin.id,
    })),
    skipDuplicates: true,
  });

  const allDepts = await prisma.department.findMany();
  const allCats = await prisma.serviceCategory.findMany();
  const deptMap = new Map(allDepts.map((d) => [d.name, d.id]));
  const catMap = new Map(allCats.map((c) => [c.name, c.id]));

  console.log('Seeding lab/radiology stub services (no pharmacy)...');
  const rawServices = readCsvData(requireCsv('mian.csv'));
  const servicesToInsert = rawServices
    .map((row: any) => {
      const cleanCost = String(row['Service Rate'] || '0').replace(
        /[₦,\s]/g,
        '',
      );
      return {
        searviceCode: String(row['Service Code'] ?? '').trim(),
        name: String(row['Service Name'] ?? '').trim(),
        cost: parseFloat(cleanCost) || 0,
        departmentId: deptMap.get(String(row['Department'] ?? '').trim()),
        categoryId: catMap.get(String(row['Category'] ?? '').trim()),
        createdById: admin.id,
      };
    })
    .filter((row) => row.searviceCode && row.name);

  const existingCodes = new Set(
    (
      await prisma.service.findMany({
        select: { searviceCode: true },
      })
    ).map((s) => s.searviceCode),
  );
  const newServices = servicesToInsert.filter(
    (s) => !existingCodes.has(s.searviceCode),
  );

  const result = await prisma.service.createMany({
    data: newServices,
    skipDuplicates: true,
  });

  console.log(`Inserted ${result.count} services.`);
  console.log('Diagnostics seed complete. No pharmacy drugs were imported.');
  console.log(
    `Login with email=${process.env.SEED_ADMIN_EMAIL ?? 'admin@diagnostics.local'} ` +
      `(change password after first login).`,
  );
}

main()
  .catch((e) => {
    console.error('Error during diagnostics seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
