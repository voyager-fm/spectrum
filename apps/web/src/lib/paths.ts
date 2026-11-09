/** Dashboard routes shared by server pages and client navigation. */

export type RepositoryTab = 'overview' | 'specs';

/** Dashboard path of a connected GitHub repository. */
export function repositoryPath(owner: string, repo: string, tab: RepositoryTab = 'overview') {
  const base = `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return tab === 'specs' ? `${base}/specs` : base;
}

/** Dashboard path of the local repository this server reads. */
export function localPath(tab: RepositoryTab = 'overview') {
  return tab === 'specs' ? '/specs' : '/';
}

export interface RepositoryContext {
  kind: 'local' | 'github';
  owner?: string;
  repo?: string;
  tab: RepositoryTab;
}

/** Which repository and tab a dashboard path shows. Unknown paths belong to the local one. */
export function repositoryContext(pathname: string): RepositoryContext {
  const match = /^\/repositories\/([^/]+)\/([^/]+)(\/specs(?:\/|$))?/.exec(pathname);
  if (match) {
    return {
      kind: 'github',
      owner: decodeURIComponent(match[1]),
      repo: decodeURIComponent(match[2]),
      tab: match[3] ? 'specs' : 'overview',
    };
  }
  return {
    kind: 'local',
    tab: pathname === '/specs' || pathname.startsWith('/specs/') ? 'specs' : 'overview',
  };
}

export interface NavTarget {
  href: string;
  active: boolean;
}

/**
 * Sidebar Specification links for a dashboard path. Overview and Specs follow the repository the
 * path shows; Rules reads only the local repository, so it is `null` for a connected one.
 */
export function specificationNav(pathname: string): {
  overview: NavTarget;
  specs: NavTarget;
  rules: NavTarget | null;
} {
  const context = repositoryContext(pathname);
  const remote = context.kind === 'github' && context.owner && context.repo ? context : null;
  const inTab = remote !== null || pathname === '/' || /^\/specs(\/|$)/.test(pathname);
  const href = (tab: RepositoryTab) =>
    remote ? repositoryPath(remote.owner ?? '', remote.repo ?? '', tab) : localPath(tab);
  return {
    overview: { href: href('overview'), active: inTab && context.tab === 'overview' },
    specs: { href: href('specs'), active: inTab && context.tab === 'specs' },
    rules: remote ? null : { href: '/rules', active: /^\/rules(\/|$)/.test(pathname) },
  };
}
