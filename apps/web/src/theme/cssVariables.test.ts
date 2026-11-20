import { describe, expect, it } from 'vitest';
import { toCssVariables, toRootCss } from './cssVariables';
import { colors, radii } from './tokens';

describe('toCssVariables', () => {
  it('exposes every colour token as a kebab-cased --acme custom property', () => {
    const vars = toCssVariables() as Record<string, string>;

    expect(vars['--acme-color-accent']).toBe(colors.accent);
    expect(vars['--acme-color-grey50']).toBe(colors.grey50);
    expect(vars['--acme-color-accent-hover']).toBe(colors.accentHover);
  });

  it('expresses radii in pixels', () => {
    const vars = toCssVariables() as Record<string, string>;

    expect(vars['--acme-radius-xl']).toBe(`${radii.xl}px`);
  });

  it('exposes the type scale in rem with a line height per step', () => {
    const vars = toCssVariables() as Record<string, string>;

    expect(vars['--acme-text-sm']).toBe('0.875rem');
    expect(vars['--acme-leading-sm']).toBe('1.25rem');
    expect(vars['--acme-text-xxxl']).toBe('1.875rem');
  });
});

describe('toRootCss', () => {
  it('declares the variables on :root so portalled dialogs can read them', () => {
    const css = toRootCss();

    expect(css.startsWith(':root{')).toBe(true);
    expect(css).toContain(`--acme-color-accent:${colors.accent};`);
    expect(css).toContain(`--acme-radius-xxl:${radii.xxl}px;`);
  });
});
