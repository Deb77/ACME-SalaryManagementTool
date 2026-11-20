import type { PageSkeletonVariant } from '../components';

/** The skeleton that looks most like the screen a path is about to show. */
export function skeletonFor(pathname: string): PageSkeletonVariant {
  if (/^\/employees\/(new|[^/]+\/edit)$/.test(pathname)) return 'form';
  if (pathname === '/employees/import') return 'form';
  if (/^\/employees\/[^/]+$/.test(pathname)) return 'detail';
  if (pathname.startsWith('/insights')) return 'dashboard';
  if (pathname.startsWith('/access')) return 'cards';
  return 'list';
}
