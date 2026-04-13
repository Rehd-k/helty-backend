import type { PrismaClient } from '@prisma/client';
import type { DmmfField, DmmfModel } from './dmmf-models';
import { modelUsesAutoincrementId } from './dmmf-models';

/** Prisma default table/column names from DMMF (no raw user input). */
function assertSimpleIdent(name: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Sequence sync: unsupported identifier "${name}".`);
  }
}

/**
 * After a full restore, PostgreSQL sequences for `@default(autoincrement())` IDs can lag behind MAX(id).
 * Enable with `SYNC_SEQUENCES=1` when restoring dumps that include explicit serial IDs.
 */
export async function syncPostgresSequences(prisma: PrismaClient, models: DmmfModel[]): Promise<void> {
  for (const m of models) {
    if (!modelUsesAutoincrementId(m)) continue;
    const idField = m.fields.find((f) => f.isId && f.kind === 'scalar') as
      | (DmmfField & { dbName?: string | null })
      | undefined;
    if (!idField) continue;

    const tableName = m.dbName ?? m.name;
    const columnName = idField.dbName ?? idField.name;
    assertSimpleIdent(tableName);
    assertSimpleIdent(columnName);

    const seqRows = await prisma.$queryRawUnsafe<{ seq: string | null }[]>(
      `SELECT pg_get_serial_sequence('public."${tableName}"', '${columnName}') AS seq`,
    );
    const seq = Array.isArray(seqRows) && seqRows[0]?.seq;
    if (!seq) continue;

    const seqLiteral = seq.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        '${seqLiteral}',
        COALESCE((SELECT MAX("${columnName}")::bigint FROM public."${tableName}"), 1),
        true
      )
    `);
  }
}
