import { readTemplateFile } from './template-files.ts';

export interface SpecificationTemplate {
  id: string;
  source: string;
  output: string;
}
export interface RenderedTemplate {
  path: string;
  content: string;
}
export type TemplateValues = Readonly<Record<string, string>>;

const token = /\{\{(text|json|tsv|path):([a-z_]+)\}\}/g;

export async function listTemplates(): Promise<SpecificationTemplate[]> {
  return JSON.parse(await readTemplateFile('catalog.json'));
}

export async function loadTemplate(
  id: string,
): Promise<SpecificationTemplate & { content: string }> {
  const template = (await listTemplates()).find((template) => template.id === id);
  if (!template) throw new Error(`Unknown specification template: ${id}`);
  return { ...template, content: await readTemplateFile(template.source) };
}

/** Returns bytes and an intended relative path; never writes or approves documents. */
export async function renderTemplate(
  id: string,
  values: TemplateValues,
): Promise<RenderedTemplate> {
  const template = await loadTemplate(id);
  function substitute(body: string, jsonString = false): string {
    return body.replace(token, (_match, kind: string, key: string) => {
      if (!Object.hasOwn(values, key) || typeof values[key] !== 'string')
        throw new Error(`Missing template value: ${key}`);
      const value = values[key];
      if (kind === 'path' && (!/^[a-zA-Z0-9_.-]+$/.test(value) || value === '.' || value === '..'))
        throw new Error(`Unsafe template path value: ${key}`);
      if (kind === 'tsv' && /[\t\r\n\0]/.test(value))
        throw new Error(`TSV value must occupy one cell: ${key}`);
      return kind === 'json' && !jsonString ? JSON.stringify(value) : value;
    });
  }
  let content: string;
  if (template.source.endsWith('.json')) {
    // Parse before substitution so quotes/newlines in values cannot alter JSON structure.
    function expand(value: unknown): unknown {
      if (typeof value === 'string') return substitute(value, true);
      if (Array.isArray(value)) return value.map(expand);
      if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expand(item)]));
      return value;
    }
    content = `${JSON.stringify(expand(JSON.parse(template.content)), null, 2)}\n`;
  } else content = substitute(template.content);
  return { path: substitute(template.output), content };
}
