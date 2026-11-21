/** Only same-app paths, so `?next=` cannot send people to another site after sign-in. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : '/';
}
