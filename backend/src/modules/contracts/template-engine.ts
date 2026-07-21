import { AppError } from '@/shared/errors/app-error.js';

const TAG_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export type TemplateVars = Record<string, string | number | null | undefined>;

export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(TAG_RE, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null || value === '') {
      throw new AppError({
        code: 'TEMPLATE_VARIABLE_MISSING',
        message: `Template variable "${key}" is missing`,
        statusCode: 400,
        details: { key },
      });
    }
    return String(value);
  });
}

export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(body)) !== null) {
    if (m[1] !== undefined) found.add(m[1]);
  }
  return Array.from(found).sort();
}
