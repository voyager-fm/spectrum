export interface ExternalLink {
  provider: 'github' | 'linear';
  url: string;
  externalId: string;
}
export interface ReviewRequest {
  repository: string;
  pullRequest: number;
  headSha: string;
}
export interface ReviewAdapter {
  review(request: ReviewRequest): Promise<{ summary: string }>;
}
// Contract only: no GitHub App, webhook, Linear sync, or outbound posts implemented.
