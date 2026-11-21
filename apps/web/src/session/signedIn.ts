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
