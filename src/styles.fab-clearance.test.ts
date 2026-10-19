import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'styles.css'), 'utf-8');

function ruleBlock(selector: RegExp): string {
  const match = css.match(selector);
  if (!match) throw new Error(`block not found for ${selector}`);
  return match[0];
}

function resolvePx(value: string): number {
  const varMatch = value.match(/^var\((--[a-z0-9-]+)\)$/);
  if (varMatch) {
    const tokenMatch = css.match(new RegExp(`${varMatch[1]}:\\s*(-?\\d+(?:\\.\\d+)?)px`));
    if (!tokenMatch) throw new Error(`token ${varMatch[1]} not found`);
    return Number(tokenMatch[1]);
  }
  const px = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!px) throw new Error(`unsupported length value: ${value}`);
  return Number(px[1]);
}

// Browser default root font size; the stylesheet never overrides `html`'s
// font-size, so this is the same base the real browser uses to resolve rem.
const ROOT_FONT_SIZE_PX = 16;
// Browser default (UA) line-height for inline content with no CSS override,
// as a multiple of the font size; `.floating-action-btn` sets no line-height.
const UA_NORMAL_LINE_HEIGHT_RATIO = 1.15;

function lengthToPx(value: string): number {
  const rem = value.match(/^(-?\d+(?:\.\d+)?)rem$/);
  if (rem) return Number(rem[1]) * ROOT_FONT_SIZE_PX;
  const px = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (px) return Number(px[1]);
  throw new Error(`unsupported length value: ${value}`);
}

// AC-F1: on every page (not only the Dashboard), scrolled content must never
// end up hidden behind the fixed "+ Lançar" FAB. Reading styles.css for real
// (not re-typing numbers here) is what makes this a regression test instead
// of a tautology: it fails the moment someone shrinks .container's bottom
// padding back below the FAB's real footprint, grows the FAB's font size, or
// deepens its shadow.
describe('AC-F1: main.container leaves clearance for the floating action button', () => {
  it('keeps a bottom padding at least as tall as the FAB offset + height + shadow margin', () => {
    const containerBlock = ruleBlock(/\.container\s*\{[^}]*\}/);
    const paddingMatch = containerBlock.match(/padding:\s*([^;]+);/);
    if (!paddingMatch) throw new Error('padding not found on .container');
    const parts = (paddingMatch[1] as string).trim().split(/\s+/);
    const bottomPx = resolvePx(parts[parts.length - 1] as string);

    const fabBlock = ruleBlock(/\.floating-action-btn\s*\{[^}]*\}/);

    const fabOffsetMatch = fabBlock.match(/bottom:\s*(-?\d+(?:\.\d+)?)px/);
    if (!fabOffsetMatch) throw new Error('bottom offset not found on .floating-action-btn');
    const fabOffset = Number(fabOffsetMatch[1]);

    const fabPaddingMatch = fabBlock.match(/padding:\s*(-?\d+(?:\.\d+)?)px/);
    const fabVerticalPadding = fabPaddingMatch ? Number(fabPaddingMatch[1]) : 0;

    const fontSizeMatch = fabBlock.match(/font-size:\s*(-?\d+(?:\.\d+)?(?:px|rem))/);
    if (!fontSizeMatch) throw new Error('font-size not found on .floating-action-btn');
    const fontSizePx = lengthToPx(fontSizeMatch[1] as string);
    const estimatedTextHeight = fontSizePx * UA_NORMAL_LINE_HEIGHT_RATIO;
    const estimatedFabHeight = fabVerticalPadding * 2 + estimatedTextHeight;

    const shadowMatch = fabBlock.match(
      /box-shadow:\s*(-?\d+(?:\.\d+)?)(?:px)?\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px/,
    );
    if (!shadowMatch) throw new Error('box-shadow not found on .floating-action-btn');
    const [, , offsetYStr, blurStr] = shadowMatch;
    const shadowMargin = Number(offsetYStr) + Number(blurStr);

    const minimumClearance = fabOffset + estimatedFabHeight + shadowMargin;

    expect(bottomPx).toBeGreaterThanOrEqual(minimumClearance);
    expect(bottomPx).toBeGreaterThanOrEqual(96);
  });
});
