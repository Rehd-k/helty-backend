import type { DmmfModel } from './dmmf-models';
import { getFkPrerequisiteEdges } from './dmmf-models';

export type InsertOrderResult = {
  /** Model names in safe insert order (parents before children). */
  order: string[];
  /** True if the FK prerequisite graph has a cycle; use PostgreSQL session_replication_role for restore. */
  hasCycle: boolean;
};

/**
 * Builds prerequisite graph: edge parent → child means parent rows must be inserted before child.
 * Kahn topological sort. If not all nodes are sorted, `hasCycle` is true.
 */
export function computeInsertOrder(models: DmmfModel[]): InsertOrderResult {
  const names = models.map((m) => m.name);
  const nameSet = new Set(names);
  const edges = getFkPrerequisiteEdges(models);

  const adj = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();

  for (const n of nameSet) {
    adj.set(n, new Set());
    indegree.set(n, 0);
  }

  for (const [parent, child] of edges) {
    if (!nameSet.has(parent) || !nameSet.has(child)) continue;
    const set = adj.get(parent)!;
    if (!set.has(child)) {
      set.add(child);
      indegree.set(child, (indegree.get(child) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const n of nameSet) {
    if ((indegree.get(n) ?? 0) === 0) queue.push(n);
  }

  const order: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const child of adj.get(n) ?? []) {
      const d = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, d);
      if (d === 0) queue.push(child);
    }
  }

  const hasCycle = order.length !== nameSet.size;

  if (hasCycle) {
    const remaining = [...nameSet].filter((n) => !order.includes(n));
    const tieBreak = (a: string, b: string) => a.localeCompare(b);
    return {
      order: [...order, ...remaining.sort(tieBreak)],
      hasCycle: true,
    };
  }

  return { order, hasCycle: false };
}
