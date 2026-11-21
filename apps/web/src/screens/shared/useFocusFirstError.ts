import { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE = 'input:not([type="hidden"]), select, textarea, button, [tabindex]';

/**
 * Focuses the first invalid control (`aria-invalid="true"`) inside `root` and scrolls it into
 * view. A fieldset group (ChoiceChips) focuses its first enabled option. The scroll respects
 * the `scroll-margin` in form.module.css, which keeps the field clear of the sticky bars.
 * Returns whether a field was found.
 */
export function focusFirstInvalid(root: ParentNode | null): boolean {
  const invalid = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!invalid) return false;
  const target = invalid.matches(FOCUSABLE)
    ? invalid
    : Array.from(invalid.querySelectorAll<HTMLElement>(FOCUSABLE)).find(
        (el) => !el.matches(':disabled'),
      );
  target?.focus({ preventScroll: true });
  invalid.scrollIntoView?.({ block: 'nearest' });
  return true;
}

/**
 * After a failed submit, leads the person to the first error. Put `ref` on the form (or the
 * element holding the fields) and call `focusFirstError()` alongside setting the errors; the
 * focus moves once the errors have rendered.
 */
export function useFocusFirstError<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null);
  const requested = useRef(false);

  // No deps: runs after the render that shows the errors set alongside the request.
  useEffect(() => {
    if (!requested.current) return;
    requested.current = false;
    focusFirstInvalid(ref.current);
  });

  const focusFirstError = useCallback(() => {
    requested.current = true;
  }, []);

  return { ref, focusFirstError };
}
