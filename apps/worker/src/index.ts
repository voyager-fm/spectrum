export interface SpecJob { id: string; repository: string; revision: string; kind: 'discover' | 'draft' | 'review' }
export async function runJob(_job: SpecJob): Promise<never> {
  throw new Error('Worker queue and model provider are not implemented');
}
