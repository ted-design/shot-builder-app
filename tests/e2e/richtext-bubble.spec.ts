import { test, expect } from '@playwright/test';

async function openBubble(page) {
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.type('Hello world');
  // Select the word 'Hello' to trigger bubble
  await page.dblclick('text=Hello');
  await expect(page.locator('[data-tippy-root] .tippy-box')).toBeVisible();
}

test.describe('RichTextEditor bubble menu visibility', () => {
  test('icons/text visible in light mode and use stroke-only', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/dev/richtext');
    await openBubble(page);

    const box = page.locator('[data-tippy-root] .tippy-box').first();
    const btn = box.locator('button').first();
    await expect(btn).toBeVisible();

    // Ensure foreground contrasts with background and svg uses stroke only
    const { fg, bg } = await box.evaluate((el) => {
      const btn = el.querySelector('button');
      const fg = getComputedStyle(btn!).color;
      const bg = getComputedStyle(el).backgroundColor;
      return { fg, bg };
    });

    function luminance(s: string) {
      const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return 0;
      const [r, g, b] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)].map((v) => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const L1 = luminance(fg), L2 = luminance(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    expect(ratio).toBeGreaterThan(2.4);

    const svg = btn.locator('svg').first();
    await expect(svg).toBeVisible();
    const stroke = await svg.evaluate((el) => getComputedStyle(el).stroke);
    const fill = await svg.evaluate((el) => getComputedStyle(el).fill);
    expect(fill === 'none' || /rgba\(0, 0, 0, 0\)/.test(fill)).toBeTruthy();
    expect(stroke && stroke !== 'none').toBeTruthy();
  });

  test('icons/text visible in dark mode and use stroke-only', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/dev/richtext');
    // Toggle theme to dark via demo page button
    await page.getByRole('button', { name: /Toggle theme/ }).click();
    await openBubble(page);

    const box = page.locator('[data-tippy-root] .tippy-box').first();
    const btn = box.locator('button').first();
    const { fg, bg } = await box.evaluate((el) => {
      const btn = el.querySelector('button');
      const fg = getComputedStyle(btn!).color;
      const bg = getComputedStyle(el).backgroundColor;
      return { fg, bg };
    });
    function luminance(s: string) {
      const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return 0;
      const [r, g, b] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)].map((v) => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const L1 = luminance(fg), L2 = luminance(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    expect(ratio).toBeGreaterThan(2.4);

    const svg = btn.locator('svg').first();
    const stroke = await svg.evaluate((el) => getComputedStyle(el).stroke);
    const fill = await svg.evaluate((el) => getComputedStyle(el).fill);
    expect(fill === 'none' || /rgba\(0, 0, 0, 0\)/.test(fill)).toBeTruthy();
    expect(stroke && stroke !== 'none').toBeTruthy();
  });
});
