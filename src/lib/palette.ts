import type { Theme } from './theme';

export interface Palette {
  surface: string;
  textPrimary: string;
  textSecondary: string;
  axis: string;
  grid: string;
  accent: string;
  statusGood: string;
  statusWarning: string;
  statusSerious: string;
  statusCritical: string;
  income: string;
  expense: string;
  balance: string;
  netWorth: string;
  debt: string;
  debtProjection: string;
  invested: string;
  current: string;
  saved: string;
  ideal: string;
  categories: string[];
  otherCategory: string;
}

/**
 * Categorical slots validated via the dataviz skill's validate_palette.js
 * (adjacent CVD + normal-vision floor, both modes) as blue, orange, violet,
 * yellow, magenta, green, red, in that order — skipping the reference's
 * "aqua" slot, reserved for the brand accent so it never doubles as a
 * series color. The reference's default order puts orange and yellow
 * adjacent once aqua is removed, which fails the normal-vision floor; this
 * is the re-ordering the skill's own docs call for in that case.
 */
const CATEGORY_SLOTS_LIGHT = ['#2a78d6', '#eb6834', '#4a3aa7', '#eda100', '#e87ba4', '#008300', '#e34948'];
const CATEGORY_SLOTS_DARK = ['#3987e5', '#d95926', '#9085e9', '#c98500', '#d55181', '#008300', '#e66767'];

/**
 * `statusCritical` (and `debt`/`debtProjection`, the same role) is `#d03b3b`
 * in BOTH modes, matching the dataviz reference's "never themed" status
 * table. The dark theme used to override it to `#e66767` for extra contrast,
 * but that hex is also the dark categorical "red" slot above — a status
 * color and a series color sharing one hex is exactly what the NEVER rule
 * forbids (BUG-03/B-03). `#e66767` still exists as `--text-danger` in
 * styles.css for UI text that needs more contrast than a chart line does,
 * it just isn't reused as the chart/status fill color anymore.
 */
const STATUS_CRITICAL = '#d03b3b';

const LIGHT: Palette = {
  surface: '#fcfcfb',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  axis: '#898781',
  grid: '#e1e0d9',
  accent: '#1baf7a',
  statusGood: '#0ca30c',
  statusWarning: '#fab219',
  statusSerious: '#ec835a',
  statusCritical: STATUS_CRITICAL,
  income: '#0ca30c',
  expense: '#ec835a',
  balance: '#52514e',
  netWorth: '#1baf7a',
  debt: STATUS_CRITICAL,
  debtProjection: STATUS_CRITICAL,
  invested: '#1baf7a',
  current: '#52514e',
  saved: '#1baf7a',
  ideal: '#52514e',
  categories: CATEGORY_SLOTS_LIGHT,
  otherCategory: '#898781',
};

const DARK: Palette = {
  surface: '#1a1a19',
  textPrimary: '#ffffff',
  textSecondary: '#c3c2b7',
  axis: '#898781',
  grid: '#2c2c2a',
  accent: '#199e70',
  statusGood: '#0ca30c',
  statusWarning: '#fab219',
  statusSerious: '#ec835a',
  statusCritical: STATUS_CRITICAL,
  income: '#0ca30c',
  expense: '#ec835a',
  balance: '#c3c2b7',
  netWorth: '#199e70',
  debt: STATUS_CRITICAL,
  debtProjection: STATUS_CRITICAL,
  invested: '#199e70',
  current: '#c3c2b7',
  saved: '#199e70',
  ideal: '#c3c2b7',
  categories: CATEGORY_SLOTS_DARK,
  otherCategory: '#898781',
};

export function paletteFor(theme: Theme): Palette {
  return theme === 'dark' ? DARK : LIGHT;
}
