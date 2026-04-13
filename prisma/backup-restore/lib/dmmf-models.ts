import { Prisma } from '@prisma/client';

/** Minimal DMMF shapes we need (avoids coupling to @prisma/generator-helper). */
export type DmmfField = {
  name: string;
  kind: 'scalar' | 'object' | 'enum' | 'unsupported';
  type: string;
  isId: boolean;
  isRequired: boolean;
  isList: boolean;
  relationName?: string | null;
  relationFromFields?: string[];
  relationToFields?: string[];
};

export type DmmfModel = {
  name: string;
  dbName: string | null;
  fields: DmmfField[];
  /** Present on Prisma views; skip for write operations */
  isView?: boolean;
};

export type DmmfDatamodel = {
  models: DmmfModel[];
  enums: { name: string }[];
};

/** Prisma client delegate key for a PascalCase model name (e.g. InvoiceItem → invoiceItem). */
export function modelNameToDelegateKey(modelName: string): string {
  if (!modelName) return modelName;
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/**
 * Loads the Prisma datamodel from `Prisma.dmmf` (populated when the client is generated).
 * Run `npx prisma generate` if this throws.
 */
export async function loadDatamodel(): Promise<DmmfDatamodel> {
  const embedded = Prisma.dmmf?.datamodel as unknown as DmmfDatamodel | undefined;
  if (embedded?.models?.length) {
    return embedded;
  }
  throw new Error(
    'Prisma DMMF is empty. Run `npx prisma generate` (from the project root) before backup/restore.',
  );
}

export function getScalarFieldNames(model: DmmfModel): string[] {
  return model.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum').map((f) => f.name);
}

export function getPrimaryKeyFieldNames(model: DmmfModel): string[] {
  const ids = model.fields.filter((f) => f.isId && (f.kind === 'scalar' || f.kind === 'enum'));
  return ids.map((f) => f.name);
}

/**
 * Foreign-key edges for insert ordering: referenced model → dependent model
 * (parent must exist before child row is inserted).
 */
export function getFkPrerequisiteEdges(models: DmmfModel[]): Array<[parent: string, child: string]> {
  const modelNames = new Set(models.map((m) => m.name));
  const edges: Array<[string, string]> = [];

  for (const m of models) {
    for (const f of m.fields) {
      if (f.kind !== 'object') continue;
      const from = f.relationFromFields;
      if (!from?.length) continue;
      const parent = f.type;
      if (!modelNames.has(parent)) continue;
      // Self-relations (e.g. Staff.createdBy → Staff) break a pure topological sort and
      // would leave many models in an arbitrary "remaining" bucket. Omit self-edges for
      // cross-table ordering; PostgreSQL restore still defers FK checks by default (see restore.ts).
      if (parent === m.name) continue;
      edges.push([parent, m.name]);
    }
  }

  return edges;
}

/**
 * Models that use DB autoincrement (PostgreSQL sequences may need sync after restore).
 */
export function modelUsesAutoincrementId(model: DmmfModel): boolean {
  const idField = model.fields.find((f) => f.isId && f.kind === 'scalar');
  if (!idField) return false;
  const def = (idField as unknown as { default?: { name: string } | string }).default;
  if (typeof def === 'string') return def === 'autoincrement';
  return def?.name === 'autoincrement';
}

export function filterWritableModels(datamodel: DmmfDatamodel, prisma: object): DmmfModel[] {
  const out: DmmfModel[] = [];
  for (const m of datamodel.models) {
    if (m.isView) continue;
    const key = modelNameToDelegateKey(m.name);
    const delegate = (prisma as Record<string, { findMany?: unknown }>)[key];
    if (delegate && typeof delegate.findMany === 'function') {
      out.push(m);
    }
  }
  return out;
}
