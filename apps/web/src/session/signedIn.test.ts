import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadRestoredPageAfterSignOut, rememberSignedIn } from './signedIn';

/** A `pageshow` as the browser fires it; `persisted` means it came from the back/forward cache. */
function pageShow(persisted: boolean) {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: persisted });
  window.dispatchEvent(event);
}

describe('reloadRestoredPageAfterSignOut', () => {
  let stop = () => {};
  afterEach(() => {
    stop();
    window.localStorage.clear();
  });

  it('reloads a page brought back by Back after this browser signed out', () => {
    const reload = vi.fn();
    stop = reloadRestoredPageAfterSignOut(reload);
    rememberSignedIn(false);
    pageShow(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('leaves a restored page alone while still signed in', () => {
    const reload = vi.fn();
    stop = reloadRestoredPageAfterSignOut(reload);
    rememberSignedIn(true);
    pageShow(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it('ignores an ordinary page load', () => {
    const reload = vi.fn();
    stop = reloadRestoredPageAfterSignOut(reload);
    pageShow(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
