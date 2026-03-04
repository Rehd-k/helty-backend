import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as xlsx from 'xlsx';

// 2. Initialize Prisma with the PG Adapter, matching your PrismaService
const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
    }),
});
const STAFF_ID = 'f5edecdc-caf9-4420-8089-ed0ac1049b1c';

// A quick helper function to read CSVs into JSON arrays
function readCsvData(filePath: string) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
}

async function main() {
    console.log('1. Seeding Departments...');
    // Assuming your departments CSV has a header named "Department"
    const rawDepartments = readCsvData('C:/Users/Rhed/Documents/hospital/backend/prisma/REF_Departments.csv');
    const deptData = rawDepartments.map((row: any) => ({
        name: row['Department'],
        createdById: STAFF_ID,
    }));
    await prisma.department.createMany({
        data: deptData,
        skipDuplicates: true
    });

    console.log('2. Seeding Categories...');
    // Assuming your categories CSV has a header named "Category"
    const rawCategories = readCsvData('C:/Users/Rhed/Documents/hospital/backend/prisma/REF_Categories.csv');
    const catData = rawCategories.map((row: any) => ({
        name: row['Category'],
        createdById: STAFF_ID,
    }));
    await prisma.serviceCategory.createMany({
        data: catData,
        skipDuplicates: true
    });

    console.log('3. Fetching new UUIDs for mapping...');
    const allDepts = await prisma.department.findMany();
    const allCats = await prisma.serviceCategory.findMany();

    // Create instant-lookup maps: {"Cardiology" => "uuid-1234"}
    const deptMap = new Map(allDepts.map(d => [d.name, d.id]));
    const catMap = new Map(allCats.map(c => [c.name, c.id]));

    console.log('4. Seeding Services...');
    // Read your newly combined single CSV file
    const rawServices = readCsvData('C:/Users/Rhed/Documents/hospital/backend/prisma/mian.csv');

    const servicesToInsert = rawServices.map((row: any) => {
        // Clean the Naira sign and commas just like before
        const cleanCost = String(row['Service Rate'] || '0').replace(/[₦,\s]/g, '');

        return {
            searviceCode: row['Service Code'], // Keeping your exact schema spelling
            name: row['Service Name'],
            cost: parseFloat(cleanCost),
            departmentId: deptMap.get(row['Department']), // Returns undefined if not found
            categoryId: catMap.get(row['Category']),      // Returns undefined if not found
            createdById: STAFF_ID,
        };
    });

    const result = await prisma.service.createMany({
        data: servicesToInsert,
        skipDuplicates: true,
    });

    console.log(`Success! Inserted ${result.count} services into the database.`);
}

main()
    .catch((e) => {
        console.error('Error during database seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });