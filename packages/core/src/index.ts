export type SpecStatus = 'draft' | 'approved';
export interface Spec {
  id: string;
  title: string;
  status: SpecStatus;
  path: string;
  acceptance: string[];
  links: string[];
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
}
export interface CheckResult {
  ok: boolean;
  findings: Finding[];
  specs: Spec[];
}
