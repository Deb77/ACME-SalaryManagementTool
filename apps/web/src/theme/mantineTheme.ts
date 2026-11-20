import { createTheme, type MantineColorsTuple } from '@mantine/core';
import { colors, fonts, radii, typeScale } from './tokens';

/**
 * Mantine theme built from our tokens. It only sets what Mantine needs to pick
 * colours, fonts and radii; the look of each component lives in that
 * component's CSS module, which reads the same tokens as `--acme-*` variables.
 */

// Mantine wants ten shades; index 6 is the primary and 7 its hover.
const acme: MantineColorsTuple = [
  colors.green50,
  colors.green100,
  colors.green200,
  colors.green300,
  colors.green500,
  colors.green500,
  colors.accent,
  colors.accentHover,
  colors.accentStrong,
  colors.accentStrong,
];

export const mantineTheme = createTheme({
  primaryColor: 'acme',
  primaryShade: 6,
  colors: { acme },
  black: colors.grey900,
  fontFamily: fonts.sans,
  fontFamilyMonospace: fonts.mono,
  headings: { fontFamily: fonts.sans },
  defaultRadius: 'md',
  radius: {
    xs: `${radii.sm}px`,
    sm: `${radii.sm}px`,
    md: `${radii.md}px`,
    lg: `${radii.lg}px`,
    xl: `${radii.xl}px`,
  },
  focusRing: 'auto',
  // Mantine's size names already use the same steps as `typeScale` (12/14/16/18/20); the
  // line heights are set to match it instead of Mantine's looser 1.55 default.
  fontSizes: {
    xs: `${typeScale.xs.size}rem`,
    sm: `${typeScale.sm.size}rem`,
    md: `${typeScale.md.size}rem`,
    lg: `${typeScale.lg.size}rem`,
    xl: `${typeScale.xl.size}rem`,
  },
  lineHeights: {
    xs: String(typeScale.xs.lineHeight / typeScale.xs.size),
    sm: String(typeScale.sm.lineHeight / typeScale.sm.size),
    md: String(typeScale.md.lineHeight / typeScale.md.size),
    lg: String(typeScale.lg.lineHeight / typeScale.lg.size),
    xl: String(typeScale.xl.lineHeight / typeScale.xl.size),
  },
});
