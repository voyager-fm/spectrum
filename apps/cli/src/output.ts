import type { CheckResult, Finding } from '@spectrum/core';

export type OutputFormat = 'json' | 'text' | 'github';
export type ListOutputFormat = Exclude<OutputFormat, 'github'>;

export function parseOutputFormat(value?: string, allowGithub?: false): ListOutputFormat;
export function parseOutputFormat(value: string | undefined, allowGithub: true): OutputFormat;
export function parseOutputFormat(value: string | undefined, allowGithub: boolean): OutputFormat;
export function parseOutputFormat(value = 'json', allowGithub = false): OutputFormat {
  if (value === 'json' || value === 'text') return value;
  if (value === 'github' && allowGithub) return value;
  if (value === 'github') throw new Error('The github output format is supported only for check.');
  throw new Error(
    `Unsupported output format: ${value}. Expected json, text${allowGithub ? ', or github' : ''}.`,
  );
}

/** Keep human output line-oriented, with no terminal control sequences from repository text. */
function isControl(character: string): boolean {
  const code = character.charCodeAt(0);
  return code < 32 || (code >= 127 && code <= 159) || code === 0x2028 || code === 0x2029;
}

function singleLine(value: string): string {
  return Array.from(value, (character) => {
    if (!isControl(character)) return character;
    if (character === '\n') return '\\n';
    if (character === '\r') return '\\r';
    if (character === '\t') return '\\t';
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
  }).join('');
}

// GitHub workflow commands decode data and properties differently. Escape percent first.
// See actions/runner src/Runner.Common/ActionCommand.cs and actions/toolkit core command.ts.
function escapeData(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}
function escapeProperty(value: string): string {
  return escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

/** Lexical repository-relative paths only. A pure formatter cannot resolve filesystem symlinks. */
function annotationPath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(normalized) ||
    Array.from(normalized).some(isControl) ||
    normalized.split('/').some((part) => part === '..')
  )
    return null;
  const parts = normalized.split('/').filter((part) => part && part !== '.');
  return parts.length ? parts.join('/') : null;
}

function annotation(finding: Finding): string {
  const properties = [`title=${escapeProperty(finding.code)}`];
  const path = annotationPath(finding.path);
  if (path !== null) {
    properties.push(`file=${escapeProperty(path)}`);
    if (Number.isSafeInteger(finding.line) && (finding.line ?? 0) > 0)
      properties.push(`line=${finding.line}`);
  }
  return `::${finding.severity} ${properties.join(',')}::${escapeData(finding.message)}`;
}

function summary(result: CheckResult): string {
  const errors = result.findings.filter((finding) => finding.severity === 'error').length;
  const warnings = result.findings.filter((finding) => finding.severity === 'warning').length;
  return `Structural check: ${result.ok ? 'PASS' : 'FAIL'} | ${errors} error(s), ${warnings} warning(s) | ${result.specs.length} spec(s)`;
}

/** Formatting only: result.ok and CLI exit semantics remain owned by the checker/caller. */
export function formatCheckResult(result: CheckResult, format: OutputFormat = 'json'): string {
  const selected = parseOutputFormat(format, true);
  if (selected === 'json') return JSON.stringify(result, null, 2);
  if (selected === 'github')
    return [summary(result), ...result.findings.map(annotation)].join('\n');
  return [
    summary(result),
    ...result.findings.map((finding) => {
      const line =
        Number.isSafeInteger(finding.line) && (finding.line ?? 0) > 0 ? `:${finding.line}` : '';
      return `${finding.severity.toUpperCase()} ${singleLine(finding.path) || '(repository)'}${line} [${singleLine(finding.code)}] ${singleLine(finding.message)}`;
    }),
  ].join('\n');
}

/** JSON intentionally stays a raw spec array, not a CheckResult or presentation envelope. */
export function formatSpecList(result: CheckResult, format: ListOutputFormat = 'json'): string {
  const selected = parseOutputFormat(format);
  if (selected === 'json') return JSON.stringify(result.specs, null, 2);
  const lines = [summary(result)];
  if (!result.specs.length) lines.push('No specs found.');
  for (const spec of result.specs) {
    const checked = spec.acceptance.filter((criterion) => criterion.checked).length;
    lines.push(
      `${singleLine(spec.id)} — ${singleLine(spec.title)}`,
      `  ${singleLine(spec.path)} | feature: ${singleLine(spec.featureId)} | review: ${singleLine(spec.status)} | implementation: ${singleLine(spec.implementationStatus)}`,
      `  AC: ${spec.acceptance.length} total, ${checked} annotated checked; execution verification: not recorded`,
    );
    for (const criterion of spec.acceptance) {
      lines.push(
        `    [${criterion.checked ? 'x' : ' '}] ${singleLine(criterion.id ?? '(no ID)')}: ${singleLine(criterion.statement)}`,
      );
    }
  }
  return lines.join('\n');
}
