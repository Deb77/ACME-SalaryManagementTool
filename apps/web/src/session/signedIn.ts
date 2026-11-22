const KEY = 'acme.signedIn';

/**
 * Whether someone has signed in on this browser and not signed out since. Only a hint for the
 * first paint (app frame or plain sign-in backdrop); the session itself is always asked for.
 */
export function wasSignedIn(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberSignedIn(signedIn: boolean): void {
  try {
    if (signedIn) window.localStorage.setItem(KEY, '1');
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the first paint just assumes a signed-out visitor.
  }
}

/**
 * Browsers keep a page in memory when you leave it (the back/forward cache) and show it again,
 * as it was, on Back, without loading anything. After signing out, Back would so bring back the
 * last screen with its pay data. When a page comes back that way after this browser has signed
 * out, reload it instead: the reload asks for the session and lands on the sign-in page.
 */
export function reloadRestoredPageAfterSignOut(
  reload: () => void = () => window.location.reload(),
): () => void {
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted && !wasSignedIn()) reload();
  };
  window.addEventListener('pageshow', onPageShow);
  return () => window.removeEventListener('pageshow', onPageShow);
}
