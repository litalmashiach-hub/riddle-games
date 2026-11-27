import { describe, expect, it } from 'vitest';
import { MOST_GROWTH, STANDARD_BODY, textGrowth } from './textSize';

/** iOS's body text, in points, at each Larger Text setting (Apple's Human Interface Guidelines, Dynamic Type sizes). */
const BODY = { xSmall: 14, small: 15, medium: 16, large: 17, xLarge: 19, xxLarge: 21, xxxLarge: 23, ax1: 28, ax2: 33, ax3: 40, ax4: 47, ax5: 53 };

describe('textGrowth', () => {
  it('leaves the words as they are at the standard size, and where the probe reads nothing useful', () => {
    expect(textGrowth(STANDARD_BODY)).toBe(1);
    for (const bad of [NaN, 0, -3, Infinity]) expect(textGrowth(bad)).toBe(1);
  });

  it('keeps the game\'s own sizes at the smaller settings', () => {
    for (const px of [BODY.xSmall, BODY.small, BODY.medium]) expect(textGrowth(px)).toBe(1);
  });

  it('grows step by step with the larger settings', () => {
    const steps = [BODY.large, BODY.xLarge, BODY.xxLarge, BODY.xxxLarge, BODY.ax1, BODY.ax2].map(textGrowth);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(textGrowth(BODY.xxxLarge)).toBeCloseTo(23 / 17, 3);
  });

  it('reaches twice the size, and no more, from the third accessibility size up', () => {
    expect(MOST_GROWTH).toBe(2);
    for (const px of [BODY.ax3, BODY.ax4, BODY.ax5]) expect(textGrowth(px)).toBe(2);
  });
});
