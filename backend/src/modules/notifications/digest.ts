export interface DigestableRow {
  id: string;
  kind: string;
  subject: string | null;
  createdAt: Date | string;
}

export interface DigestGroup {
  kind: string;
  count: number;
  items: DigestableRow[];
}

/**
 * Pure: group rows by `kind` (preserving descending insertion order overall),
 * for the daily digest email template.
 */
export function groupForDigest(rows: DigestableRow[]): DigestGroup[] {
  const map = new Map<string, DigestableRow[]>();
  for (const r of rows) {
    if (!map.has(r.kind)) map.set(r.kind, []);
    map.get(r.kind)!.push(r);
  }
  return [...map.entries()].map(([kind, items]) => ({
    kind,
    count: items.length,
    items,
  }));
}

export function renderDigestEmail(groups: DigestGroup[]): {
  subject: string;
  html: string;
  text: string;
} {
  const total = groups.reduce((n, g) => n + g.count, 0);
  const subject = `Your Oakvale daily digest · ${total} update${total === 1 ? '' : 's'}`;
  const sections = groups.map((g) => {
    const items = g.items
      .map((i) => `<li>${i.subject ?? g.kind}</li>`)
      .join('');
    return `<h3>${g.kind} (${g.count})</h3><ul>${items}</ul>`;
  });
  const html = `<p>Here's what happened since yesterday:</p>${sections.join('')}`;
  const text = groups
    .map((g) => `${g.kind} (${g.count}):\n${g.items.map((i) => `- ${i.subject ?? g.kind}`).join('\n')}`)
    .join('\n\n');
  return { subject, html, text };
}
