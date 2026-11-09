/** Document review, declared implementation and executed evidence are independent. */
export type SpecStatus = 'draft' | 'in_review' | 'approved' | 'changes_requested' | 'untracked';
export interface AcceptanceCriterion {
  id: string | null;
  statement: string;
  checked: boolean;
  /** Markdown checkboxes are author annotations, never execution receipts. */
  verification: 'not_recorded';
}
export interface Spec {
  id: string;
  featureId: string;
  categoryKey: string;
  title: string;
  status: SpecStatus;
  implementationStatus: string;
  phase: string;
  path: string;
  body: string;
  acceptance: AcceptanceCriterion[];
  /** Resolved repository-relative paths, derived from the canonical documents. */
  links: string[];
}
export type InventoryKind =
  | 'objects'
  | 'surfaces'
  | 'regions'
  | 'menus'
  | 'categories'
  | 'features'
  | 'interactions'
  | 'routes'
  | 'other';
export interface InventorySource {
  kind: InventoryKind;
  data: string;
  schema: string;
}
export type DocumentSourceKind =
  | 'feature_bundle'
  | 'page_bundle'
  | 'contracts'
  | 'flows'
  | 'engineering'
  | 'rules'
  | 'reference';
export interface DocumentSource {
  kind: DocumentSourceKind;
  root: string;
}
export interface SpectrumConfig {
  schema_version: 2;
  name: string;
  mode: 'proposal-only';
  canonical_source: 'git-files';
  overview?: string;
  inventories: InventorySource[];
  documents: DocumentSource[];
  integrations?: { github?: { enabled: boolean }; linear?: { enabled: boolean } };
  agents?: { enabled: boolean; max_repair_attempts?: number };
}
export interface ColumnReference {
  table: string;
  column?: string;
  columns?: string[];
  references?: string[];
}
export interface InventoryColumn {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  enum?: (string | number | boolean)[];
  ref?: ColumnReference;
  description?: string;
}
export interface InventorySchema {
  schema_version: string;
  /** Engine-owned base schema this table extends, for example spectrum:features. */
  extends?: string;
  name: string;
  primary_key: string[];
  null_values?: string[];
  columns: InventoryColumn[];
}
export interface InventoryRow {
  line: number;
  values: Record<string, string>;
}
export interface Inventory {
  kind: InventoryKind;
  path: string;
  schemaPath: string;
  schema: InventorySchema;
  rows: InventoryRow[];
}
export type DocumentKind =
  | 'interaction'
  | 'contract'
  | 'page_contract'
  | 'flow'
  | 'layout'
  | 'page_spec'
  | 'engineering'
  | 'rule'
  | 'reference'
  | 'overview';
export interface RepositoryDocument {
  kind: DocumentKind;
  path: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  links: string[];
}
export interface Relationship {
  kind: 'reference' | 'document_link' | 'specification' | 'ownership' | 'route_contract';
  source: string;
  target: string;
  field?: string;
}
export interface RepositoryModel {
  inventories: Inventory[];
  documents: RepositoryDocument[];
  relationships: Relationship[];
}
export interface ChangeSet {
  id: string;
  baseRevision: string;
  summary: string;
  edits: { path: string; beforeHash: string; proposedText: string }[];
  status: 'proposed' | 'approved' | 'rejected';
}
export interface Finding {
  code: string;
  message: string;
  path: string;
  severity: 'error' | 'warning';
  line?: number;
}
export interface CheckResult {
  ok: boolean;
  findings: Finding[];
  specs: Spec[];
  config: SpectrumConfig | null;
  model: RepositoryModel;
}
