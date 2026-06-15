/**
 * Color constants matching the CSS variables
 * These are the only colors used throughout the app
 */
export const Colors = {
  alpha: '#ffc801',      // --color-alpha
  beta: '#212529',       // --color-beta
  error: '#ef4444',      // --color-error
  good: '#51b04f',       // --color-good
  dark_gray: '#1f2326',  // --color-dark_gray
  light: '#fafafa',      // --color-light
  dark: '#171717',       // --color-dark
  card: '#ffffff',       // home feed / post cards (light)
  card_dark: '#1c1c1c',  // home feed / post cards (dark)
  card_border_dark: '#2e2e2e',
} as const;

// Light mode uses beta/light; dark mode keeps alpha accents.
export function getAccentIconColor(isDark: boolean) {
  return isDark ? Colors.alpha : Colors.beta;
}

export function getAccentFillColor(isDark: boolean) {
  return isDark ? Colors.alpha : Colors.beta;
}

export function getOnAccentTextColor(isDark: boolean) {
  return isDark ? Colors.beta : Colors.light;
}
