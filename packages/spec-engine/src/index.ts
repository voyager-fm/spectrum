import { realpath } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import type {
  CheckResult,
  DocumentKind,
  DocumentSourceKind,
  Inventory,
  RepositoryDocument,
  SpecStatus,
} from '@spectrum/core';
import { parse as parseToml } from 'smol-toml';
import {
  parseConfiguration,
  readConfiguration,
  readRawConfiguration,
  retiredConfigurationKeys,
  strings,
  text,
} from './config.ts';
import {
  RepositoryFileError,
  readRepositoryText,
  repositoryDocuments,
  repositoryPath,
} from './files.ts';
import {
  type CatalogTable,
  checkReferences,
  concrete,
  readInventory,
  readInventoryCatalog,
  readTable,
} from './inventory.ts';
import {
  type DocumentLink,
  interactionSections,
  type MarkdownDocument,
  parseMarkdown,
  record,
} from './markdown.ts';

export {
  type BaseInventorySchemaId,
  baseInventoryKinds,
  baseInventorySchema,
  baseInventorySchemas,
} from './base-schemas.ts';
export {
  type CatalogTable,
  extendInventorySchema,
  parseInventoryCatalog,
  parseInventorySchema,
  resolveInventorySchema,
} from './inventory.ts';
export type {
  SearchInput,
  TableBinding,
  TableContract,
  TableQueryOptions,
} from './tables/query.ts';
export { createTableQuery } from './tables/query.ts';
export { readConfiguration, readRepositoryText, repositoryDocuments };
export interface CheckOptions {
  configPath?: string;
  config?: unknown;
}

function classify(
  source: DocumentSourceKind,
  path: string,
  metadata: Record<string, unknown>,
): DocumentKind {
  if (source === 'rules' || basename(path) === 'AGENTS.md') return 'rule';
  if (source === 'engineering') {
    if (!metadata.doc_type && ['README.md', 'index.md', '00_index.md'].includes(basename(path)))
      return 'reference';
    return 'engineering';
  }
  if (source === 'surface_bundle') {
    if (basename(path) === 'contract.toml') return 'surface_contract';
    if (basename(path) === 'layout.md') return 'layout';
    if (basename(path) === 'flow.md') return 'flow';
    if (basename(path) === 'spec.md') return 'surface_spec';
  }
  if (source === 'page_bundle') {
    if (basename(path) === 'contract.toml') return 'page_contract';
    if (basename(path) === 'layout.md') return 'layout';
    if (basename(path) === 'flow.md') return 'flow';
    if (basename(path) === 'spec.md') return 'page_spec';
  }
  if ((source === 'feature_bundle' || source === 'contracts') && path.endsWith('.toml'))
    return 'contract';
  if (source === 'flows' || (source === 'feature_bundle' && path.split('/').includes('flows')))
    return 'flow';
  if (source === 'feature_bundle' && text(metadata.interaction_id)) return 'interaction';
  return 'reference';
}

export async function checkRepository(
  root: string,
  options: CheckOptions = {},
): Promise<CheckResult> {
  const base = await realpath(root);
  const result: CheckResult = {
    ok: false,
    findings: [],
    specs: [],
    config: null,
    model: { inventories: [], documents: [], relationships: [] },
  };
  const { findings, specs, model } = result;
  const add = (
    code: string,
    path: string,
    message: string,
    severity: 'error' | 'warning' = 'error',
  ) => findings.push({ code, path, message, severity });
  const fileError = (error: unknown, path: string, fallback: string) => {
    add(
      error instanceof RepositoryFileError ? error.code : fallback,
      path,
      error instanceof RepositoryFileError
        ? error.message
        : `Invalid ${fallback.replaceAll('invalid-', '')} at ${path}.`,
    );
  };
  const configPath = options.configPath ?? '.spectrum/config.json';
  try {
    const raw =
      options.config !== undefined
        ? options.config
        : await readRawConfiguration(base, options.configPath);
    result.config = parseConfiguration(raw);
    for (const key of retiredConfigurationKeys(raw))
      add(
        'retired-config-key',
        configPath,
        `${key} is no longer read and does not reflect any connection. Remove it; the dashboard reports connection state from the server.`,
        'warning',
      );
  } catch (error) {
    add(
      'invalid-config',
      configPath,
      error instanceof RepositoryFileError
        ? error.message
        : error instanceof SyntaxError
          ? 'Configuration must be valid JSON.'
          : error instanceof Error
            ? error.message
            : 'Invalid configuration.',
    );
    return result;
  }
  const config = result.config;
  const addTable = (table: Inventory) => {
    if (model.inventories.some((t) => t.schema.name === table.schema.name))
      add('duplicate-table', table.schemaPath, `Table ${table.schema.name} is configured twice.`);
    else model.inventories.push(table);
  };
  const schemaError = (error: unknown, schemaPath: string, dataPath: string) => {
    if (error instanceof RepositoryFileError || !(error instanceof Error))
      fileError(error, dataPath, 'invalid-inventory');
    else
      add(
        'invalid-inventory',
        schemaPath,
        error instanceof SyntaxError ? 'Inventory schema must be valid JSON.' : error.message,
      );
  };
  for (const source of config.inventories) {
    if ('catalog' in source) {
      let tables: CatalogTable[];
      try {
        tables = await readInventoryCatalog(base, source.catalog);
      } catch (error) {
        schemaError(error, source.catalog, source.catalog);
        continue;
      }
      for (const table of tables)
        try {
          addTable(await readTable(base, table, source.catalog, findings));
        } catch (error) {
          fileError(error, table.data, 'invalid-inventory');
        }
      continue;
    }
    try {
      addTable(await readInventory(base, source, findings));
    } catch (error) {
      schemaError(error, source.schema, source.data);
    }
  }
  checkReferences(model.inventories, findings, model.relationships);

  const markdown = new Map<string, MarkdownDocument>();
  const pending = new Map<string, DocumentLink[]>();
  async function readDocument(path: string, source: DocumentSourceKind | 'overview') {
    path = relative(base, resolve(base, path));
    if (model.documents.some((doc) => doc.path === path)) return;
    try {
      const body = await readRepositoryText(base, path);
      let metadata: Record<string, unknown>;
      let title: string;
      if (path.endsWith('.toml')) {
        metadata = parseToml(body);
        const contract = record(metadata.contract) ? metadata.contract : {};
        title = text(contract.id) ? contract.id : basename(path);
        const refs: DocumentLink[] = [];
        function policyRefs(value: unknown) {
          if (typeof value === 'string')
            refs.push({ target: value, rootRelative: false, section: 'policy_refs' });
          else if (Array.isArray(value)) value.forEach(policyRefs);
          else if (record(value)) Object.values(value).forEach(policyRefs);
        }
        if (record(metadata.policy_refs)) policyRefs(metadata.policy_refs);
        pending.set(path, refs);
      } else {
        const parsed = parseMarkdown(body);
        metadata = parsed.metadata;
        title = parsed.title ?? basename(path);
        markdown.set(path, parsed);
        pending.set(path, parsed.links);
      }
      model.documents.push({
        path,
        body,
        title,
        metadata,
        kind: source === 'overview' ? 'overview' : classify(source, path, metadata),
        links: [],
      });
    } catch (error) {
      fileError(error, path, path.endsWith('.toml') ? 'invalid-contract' : 'invalid-document');
    }
  }
  if (config.overview) await readDocument(config.overview, 'overview');
  for (const source of config.documents) {
    for (const path of await repositoryDocuments(base, source.root, (error, path) =>
      fileError(error, path, 'invalid-document'),
    ))
      await readDocument(path, source.kind);
  }

  const resolvedSections = new Map<string, { path: string; section: string }[]>();
  for (const doc of model.documents) {
    const resolved: { path: string; section: string }[] = [];
    for (const link of pending.get(doc.path) ?? []) {
      if (/^(https?:|mailto:)/i.test(link.target)) continue;
      if (/^[a-z][a-z\d+.-]*:/i.test(link.target)) {
        add('unsafe-path', doc.path, 'Local document links must be repository-relative.');
        continue;
      }
      const target = link.target.split('#')[0];
      if (!target) continue;
      let path: string;
      try {
        path = relative(
          base,
          resolve(
            link.rootRelative ? base : resolve(base, dirname(doc.path)),
            decodeURIComponent(target),
          ),
        );
      } catch {
        add('broken-link', doc.path, `Invalid link encoding: ${target}`);
        continue;
      }
      try {
        try {
          await repositoryPath(base, path);
        } catch (error) {
          if (
            link.rootRelative &&
            !extname(path) &&
            error instanceof RepositoryFileError &&
            error.code === 'missing-file'
          ) {
            path += '.md';
            await repositoryPath(base, path);
          } else throw error;
        }
        doc.links.push(path);
        resolved.push({ path, section: link.section });
        model.relationships.push({ kind: 'document_link', source: doc.path, target: path });
      } catch (error) {
        if (error instanceof RepositoryFileError && error.code === 'unsafe-path')
          fileError(error, doc.path, 'unsafe-path');
        else add('broken-link', doc.path, `Missing local document: ${target}`);
      }
    }
    doc.links = [...new Set(doc.links)].sort();
    resolvedSections.set(doc.path, resolved);
  }

  const tables = (kind: Inventory['kind']) => model.inventories.filter((t) => t.kind === kind);
  const rows = (kind: Inventory['kind']) =>
    tables(kind).flatMap((t) => t.rows.map((row) => ({ ...row, path: t.path })));
  const interactions = new Map(rows('interactions').map((row) => [row.values.interaction_id, row]));
  const features = new Map(rows('features').map((row) => [row.values.feature_id, row]));
  const categories = new Map(rows('categories').map((row) => [row.values.category_key, row]));
  for (const row of features.values()) {
    const category = categories.get(row.values.category_key)?.values;
    if (
      category &&
      concrete(row.values.feature_category) &&
      row.values.feature_category !== category.category_title
    )
      add(
        'category-mismatch',
        row.path,
        `${row.values.feature_id} has a different category title from ${row.values.category_key}.`,
      );
  }
  for (const row of interactions.values()) {
    const feature = features.get(row.values.feature_id)?.values;
    if (
      feature &&
      ((concrete(row.values.feature) && row.values.feature !== feature.feature_title) ||
        (concrete(row.values.category_key) && row.values.category_key !== feature.category_key))
    )
      add(
        'feature-mismatch',
        row.path,
        `${row.values.interaction_id} must use its feature's title and category.`,
      );
  }

  const documents = new Map(model.documents.map((doc) => [doc.path, doc]));
  const contractIds = new Set<string>();
  const pageContracts = new Map<string, RepositoryDocument>();
  const surfaceContracts = new Map<string, RepositoryDocument>();
  const routes = new Map(rows('routes').map((row) => [row.values.page_id, row]));
  const regionKeys = new Set(
    tables('regions').flatMap((t) =>
      t.schema.primary_key.length === 1
        ? t.rows.map((row) => row.values[t.schema.primary_key[0]])
        : [],
    ),
  );
  const requireBundleDocuments = (doc: RepositoryDocument, label: string) => {
    for (const file of ['layout.md', 'flow.md'])
      if (!documents.has(`${dirname(doc.path)}/${file}`))
        add('missing-page-document', doc.path, `${label} requires ${file}.`);
  };
  for (const doc of model.documents) {
    if (doc.kind !== 'contract' && doc.kind !== 'page_contract' && doc.kind !== 'surface_contract')
      continue;
    const contract = record(doc.metadata.contract) ? doc.metadata.contract : {};
    if (!text(contract.id)) {
      add('invalid-contract', doc.path, 'TOML requires [contract].id.');
      continue;
    }
    if (contractIds.has(contract.id))
      add('duplicate-id', doc.path, `Duplicate contract ID ${contract.id}.`);
    contractIds.add(contract.id);
    if (text(contract.category) && !categories.has(contract.category))
      add('invalid-reference', doc.path, `Unknown contract category ${contract.category}.`);
    const objects = rows('objects');
    if (
      concrete(String(contract.primary_object_key ?? '-')) &&
      !objects.some((row) => row.values.key === contract.primary_object_key)
    )
      add(
        'invalid-reference',
        doc.path,
        `Unknown primary_object_key ${contract.primary_object_key}.`,
      );
    if (doc.metadata.ownership !== undefined && !record(doc.metadata.ownership))
      add(
        'invalid-ownership',
        doc.path,
        'ownership must be a mapping of interaction IDs to reads/writes.',
      );
    if (record(doc.metadata.ownership))
      for (const [id, owner] of Object.entries(doc.metadata.ownership)) {
        if (!interactions.has(id))
          add('invalid-ownership', doc.path, `Unknown ownership interaction ${id}.`);
        if (!record(owner) || !strings(owner.reads) || !strings(owner.writes))
          add('invalid-ownership', doc.path, `${id} requires reads and writes arrays.`);
        else model.relationships.push({ kind: 'ownership', source: doc.path, target: id });
      }
    if (doc.kind === 'page_contract') {
      const id = String(contract.page_id ?? '');
      const route = routes.get(id);
      if (!route) add('invalid-reference', doc.path, `Unknown page_id ${id}.`);
      else {
        if (
          route.values.path !== contract.path ||
          (contract.implementation_status !== undefined &&
            route.values.implementation_status !== contract.implementation_status)
        )
          add(
            'route-mismatch',
            doc.path,
            `${id} path and implementation_status must match ROUTES.`,
          );
        model.relationships.push({ kind: 'route_contract', source: id, target: doc.path });
      }
      if (pageContracts.has(id))
        add('duplicate-id', doc.path, `Duplicate page contract for ${id}.`);
      pageContracts.set(id, doc);
      requireBundleDocuments(doc, 'Page bundle');
    }
    if (doc.kind === 'surface_contract') {
      const region = contract.region;
      if (!text(region)) {
        add('invalid-contract', doc.path, 'A surface contract requires [contract].region.');
        continue;
      }
      const routeFields = ['page_id', 'path', 'implementation_status'].filter(
        (field) => contract[field] !== undefined,
      );
      if (routeFields.length)
        add(
          'invalid-contract',
          doc.path,
          `A surface contract binds by region; ${routeFields.join(', ')} belong to ROUTES.`,
        );
      if (!regionKeys.has(region)) add('invalid-reference', doc.path, `Unknown region ${region}.`);
      else model.relationships.push({ kind: 'region_contract', source: region, target: doc.path });
      if (surfaceContracts.has(region))
        add('duplicate-id', doc.path, `Duplicate surface contract for ${region}.`);
      surfaceContracts.set(region, doc);
    }
  }
  for (const row of routes.values()) {
    if (row.values.type && row.values.type !== 'page') continue;
    const region = row.values.region;
    if (region !== undefined && concrete(region)) {
      const bundle = surfaceContracts.get(region);
      if (bundle) requireBundleDocuments(bundle, `Page ${row.values.page_id}`);
      else
        add(
          'missing-page-contract',
          row.path,
          `${row.values.page_id} needs a surface contract for region ${region}.`,
        );
    } else if (!pageContracts.has(row.values.page_id))
      add('missing-page-contract', row.path, `${row.values.page_id} needs a page contract bundle.`);
  }

  for (const doc of model.documents) {
    const parsed = markdown.get(doc.path);
    if (!parsed) continue;
    if (doc.kind === 'engineering') {
      if (!text(doc.metadata.doc_type) || !text(doc.metadata.status))
        add(
          'invalid-engineering',
          doc.path,
          'Engineering frontmatter requires doc_type and status.',
        );
      if (
        doc.metadata.doc_type !== 'adr' &&
        !['current', 'target', 'mixed', 'historical'].includes(
          String(doc.metadata.implementation_state),
        )
      )
        add(
          'invalid-engineering',
          doc.path,
          'implementation_state must describe current, target, mixed or historical knowledge.',
        );
      if (doc.metadata.doc_type !== 'adr')
        for (const alternatives of [['Sources'], ['Verification', 'Evidence']])
          if (!alternatives.some((section) => parsed.sections.includes(section)))
            add(
              'missing-section',
              doc.path,
              `Engineering document requires ${alternatives.join(' or ')}.`,
            );
    }
    if (doc.kind !== 'interaction') continue;
    const id = String(doc.metadata.interaction_id);
    const row = interactions.get(id);
    if (!row) add('orphan-spec', doc.path, `No inventory interaction ${id}.`);
    else {
      model.relationships.push({ kind: 'specification', source: id, target: doc.path });
      for (const key of [
        'interaction_type',
        'feature',
        'category_key',
        'feature_id',
        'status',
        'phase',
        'summary',
        'related_region',
        'menu',
        'shortcut',
      ]) {
        if (row.values[key] !== undefined && doc.metadata[key] !== row.values[key])
          add('metadata-mismatch', doc.path, `${key} must match INTERACTIONS for ${id}.`);
      }
    }
    const actualSections = parsed.sections.filter((section) => section !== 'Boundary Notes');
    if (JSON.stringify(actualSections) !== JSON.stringify(interactionSections))
      add(
        'missing-section',
        doc.path,
        'Interaction specs require the fixed section shell in order; Boundary Notes is optional.',
      );
    if (!parsed.acceptance.length)
      add(
        'missing-acceptance',
        doc.path,
        'Acceptance Criteria requires at least one task item with a stable AC ID.',
      );
    if (parsed.invalidAcceptance.length)
      add('invalid-ac', doc.path, 'Use - [ ] **AC-<positive integer>:** statement.');
    const ids = new Set<string>();
    for (const ac of parsed.acceptance) {
      if (!ac.id) continue;
      if (ids.has(ac.id)) add('duplicate-ac', doc.path, `${id}#${ac.id} is duplicated.`);
      ids.add(ac.id);
    }
    const status = doc.metadata.document_status ?? 'untracked';
    if (
      !['draft', 'in_review', 'approved', 'changes_requested', 'untracked'].includes(String(status))
    )
      add('invalid-review-state', doc.path, 'document_status must be a document review state.');
    const sourceLinks =
      resolvedSections
        .get(doc.path)
        ?.filter((link) => link.section === 'Source')
        .map((link) => link.path) ?? [];
    const contracts = sourceLinks.filter((path) => documents.get(path)?.kind === 'contract');
    const flows = sourceLinks.filter((path) => documents.get(path)?.kind === 'flow');
    if (!contracts.length)
      add('missing-contract', doc.path, 'Source must link to a parsed TOML contract.');
    if (!flows.length) add('missing-flow', doc.path, 'Source must link to a flow.');
    for (const flow of flows)
      if (
        !resolvedSections
          .get(flow)
          ?.some((link) => link.section === 'Interaction Coverage' && link.path === doc.path)
      )
        add(
          'missing-flow-coverage',
          doc.path,
          `${flow} must list this interaction in Interaction Coverage.`,
        );
    if (specs.some((spec) => spec.id === id))
      add('duplicate-id', doc.path, `Duplicate interaction spec ${id}.`);
    specs.push({
      id,
      featureId: String(doc.metadata.feature_id ?? ''),
      categoryKey: String(doc.metadata.category_key ?? ''),
      title: doc.title,
      status: status as SpecStatus,
      implementationStatus: row?.values.status ?? 'untracked',
      phase: row?.values.phase ?? '-',
      path: doc.path,
      body: doc.body,
      acceptance: parsed.acceptance,
      links: doc.links,
    });
  }
  for (const [id, row] of interactions)
    if (
      !specs.some((spec) => spec.id === id) &&
      !['idea', 'deprecated'].includes(row.values.status)
    )
      add('missing-spec', row.path, `${id} requires one interaction Markdown spec.`);
  // Semantic policy alignment and executed AC evidence require review/runtime adapters.
  specs.sort((a, b) => a.id.localeCompare(b.id));
  findings.sort(
    (a, b) =>
      a.path.localeCompare(b.path) || (a.line ?? 0) - (b.line ?? 0) || a.code.localeCompare(b.code),
  );
  result.ok = !findings.some((finding) => finding.severity === 'error');
  return result;
}
