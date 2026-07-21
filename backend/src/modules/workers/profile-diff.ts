export interface ProfileChange {
  section: string;
  field: string;
  before: unknown;
  after: unknown;
}

// Row metadata that changes on every write and would drown out real edits.
const SKIP_KEYS = new Set(['id', 'workerId', 'createdAt', 'updatedAt']);

function flatten(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (value === null || value === undefined) {
    out.set(prefix, null);
    return;
  }
  if (value instanceof Date) {
    out.set(prefix, value.toISOString());
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SKIP_KEYS.has(k)) continue;
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
    return;
  }
  out.set(prefix, value);
}

/**
 * Leaf-level diff between the pre-edit snapshot of profile sections and the
 * current sections, for the admin "changes since approval" view.
 */
export function diffProfileSections(
  snapshot: Record<string, unknown>,
  current: Record<string, unknown>,
): ProfileChange[] {
  const before = new Map<string, unknown>();
  const after = new Map<string, unknown>();
  flatten(snapshot, '', before);
  flatten(current, '', after);

  const paths = new Set([...before.keys(), ...after.keys()]);
  const changes: ProfileChange[] = [];
  for (const path of paths) {
    const b = before.has(path) ? before.get(path) : null;
    const a = after.has(path) ? after.get(path) : null;
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    const [section, ...rest] = path.split('.');
    changes.push({ section: section ?? '', field: rest.join('.') || section || '', before: b, after: a });
  }
  return changes.sort((x, y) => x.section.localeCompare(y.section) || x.field.localeCompare(y.field));
}
