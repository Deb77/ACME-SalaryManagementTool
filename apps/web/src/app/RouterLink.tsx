import { forwardRef } from 'react';
import { Link } from 'react-router';
import type { LinkComponentProps } from '../components';

/**
 * AppLink's router adapter. API URLs and downloads are real requests, so they stay plain
 * `<a>`; everything else navigates client-side.
 */
export const RouterLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(function RouterLink(
  { href, ...props },
  ref,
) {
  if (href.startsWith('/api/') || props.download !== undefined || /^[a-z]+:/i.test(href)) {
    return <a ref={ref} href={href} {...props} />;
  }
  return <Link ref={ref} to={href} {...props} />;
});
