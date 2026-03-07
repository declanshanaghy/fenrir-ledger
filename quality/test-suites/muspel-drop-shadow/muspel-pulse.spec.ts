import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

// Read the actual globals.css file for direct CSS verification
const globalsPath = path.resolve(__dirname, '../../..', 'development/frontend/src/app/globals.css');
const cssContent = readFileSync(globalsPath, 'utf-8');

test.describe('Muspel Pulse Drop-Shadow Animation (Issue #159)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that uses the muspel-pulse animation
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // AC1: muspel-pulse keyframe includes drop-shadow modulation
  // ══════════════════════════════════════════════════════════════════════════════

  test('AC1a: muspel-pulse keyframe exists with drop-shadow', () => {
    // Verify @keyframes muspel-pulse exists
    expect(cssContent).toContain('@keyframes muspel-pulse');

    // Verify filter property with drop-shadow appears in the keyframes
    const keyframesMatch = cssContent.match(/@keyframes muspel-pulse\s*{([^}]*?)}/s);
    expect(keyframesMatch).toBeTruthy();
    if (keyframesMatch) {
      expect(keyframesMatch[1]).toContain('drop-shadow');
      expect(keyframesMatch[1]).toContain('filter');
    }
  });

  test('AC1b: drop-shadow modulates 4px → 10px → 4px', () => {
    // Check that both 4px and 10px drop-shadows exist
    expect(cssContent).toContain('drop-shadow(0 0 4px currentColor)');
    expect(cssContent).toContain('drop-shadow(0 0 10px currentColor)');

    // Verify they're in the keyframes
    const keyframesMatch = cssContent.match(/@keyframes muspel-pulse\s*{([^}]*?)}/s);
    expect(keyframesMatch).toBeTruthy();
    if (keyframesMatch) {
      const keyframesContent = keyframesMatch[1];
      expect(keyframesContent).toContain('drop-shadow(0 0 4px currentColor)');
      expect(keyframesContent).toContain('drop-shadow(0 0 10px currentColor)');
    }
  });

  test('AC1c: drop-shadow uses currentColor for fire realm aesthetic', () => {
    // All drop-shadows in muspel-pulse should use currentColor
    const keyframesMatch = cssContent.match(/@keyframes muspel-pulse\s*{([^}]*?)}/s);
    expect(keyframesMatch).toBeTruthy();

    if (keyframesMatch) {
      const keyframesContent = keyframesMatch[1];
      // Count drop-shadows using currentColor
      const currentColorDropShadows = (keyframesContent.match(/drop-shadow\([^)]*currentColor[^)]*\)/g) || []).length;
      expect(currentColorDropShadows).toBeGreaterThanOrEqual(2);

      // Verify no hardcoded RGB or hex colors in drop-shadow
      const hasRGBDropShadow = /drop-shadow\([^)]*rgb\([^)]*\)[^)]*\)/.test(keyframesContent);
      const hasHexDropShadow = /drop-shadow\([^)]*#[0-9a-f]{3,6}[^)]*\)/.test(keyframesContent);
      expect(hasRGBDropShadow).toBe(false);
      expect(hasHexDropShadow).toBe(false);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // AC2: Animation properties (1.8s, ease-in-out, infinite)
  // ══════════════════════════════════════════════════════════════════════════════

  test('AC2a: animation duration is 1.8s', () => {
    expect(cssContent).toContain('animation: muspel-pulse 1.8s ease-in-out infinite');
  });

  test('AC2b: animation uses ease-in-out timing function', () => {
    // In the context of muspel-pulse animation
    const animationMatch = cssContent.match(/animation:\s*muspel-pulse\s+[\d.]+s\s+(\w+-\w+-\w+)/);
    expect(animationMatch).toBeTruthy();
    if (animationMatch) {
      expect(animationMatch[1]).toBe('ease-in-out');
    }
  });

  test('AC2c: animation cycles infinitely', () => {
    expect(cssContent).toContain('animation: muspel-pulse 1.8s ease-in-out infinite');
  });

  test('AC2d: .animate-muspel-pulse class applies animation', () => {
    expect(cssContent).toMatch(/\.animate-muspel-pulse\s*{[\s\S]*?animation:\s*muspel-pulse[\s\S]*?}/);
  });

  test('AC2e: .ring--urgent SVG class also applies animation', () => {
    expect(cssContent).toMatch(/\.ring--urgent\s*{[\s\S]*?animation:\s*muspel-pulse[\s\S]*?}/);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // AC3: Respects prefers-reduced-motion
  // ══════════════════════════════════════════════════════════════════════════════

  test('AC3a: @media (prefers-reduced-motion: reduce) rule exists', () => {
    // Check for the reduced motion media query targeting muspel-pulse
    expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
  });

  test('AC3b: reduced-motion disables animation to none', () => {
    const reducedMotionMatch = cssContent.match(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*{([^}]*?)}/s);
    expect(reducedMotionMatch).toBeTruthy();
    if (reducedMotionMatch) {
      expect(reducedMotionMatch[1]).toContain('animation: none');
    }
  });

  test('AC3c: reduced-motion maintains static drop-shadow at 4px', () => {
    const reducedMotionMatch = cssContent.match(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*{([^}]*?)}/s);
    expect(reducedMotionMatch).toBeTruthy();
    if (reducedMotionMatch) {
      expect(reducedMotionMatch[1]).toContain('drop-shadow(0 0 4px currentColor)');
    }
  });

  test('AC3d: reduced-motion keeps opacity at 1', () => {
    const reducedMotionMatch = cssContent.match(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*{([^}]*?)}/s);
    expect(reducedMotionMatch).toBeTruthy();
    if (reducedMotionMatch) {
      expect(reducedMotionMatch[1]).toContain('opacity: 1');
    }
  });

  test('AC3e: reduced-motion applies to both .animate-muspel-pulse and .ring--urgent', () => {
    const reducedMotionMatch = cssContent.match(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*{([^}]*)\.animate-muspel-pulse([^}]*)\.ring--urgent/s);
    expect(reducedMotionMatch).toBeTruthy();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Integration tests with live DOM (if elements exist on page)
  // ══════════════════════════════════════════════════════════════════════════════

  test('Live DOM: animation applied to .animate-muspel-pulse', async ({ page }) => {
    const elements = await page.locator('[class*="animate-muspel-pulse"]').all();

    // If elements exist, verify animation is computed
    if (elements.length > 0) {
      const animation = await elements[0].evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).animation;
      });
      expect(animation).toContain('muspel-pulse');
    }
  });

  test('Live DOM: reduced-motion disables animation', async ({ context }) => {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const elements = await page.locator('[class*="animate-muspel-pulse"]').all();

    // If elements exist, verify animation is disabled
    if (elements.length > 0) {
      const animation = await elements[0].evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).animation;
      });
      expect(animation).toBe('none');
    }

    await page.close();
  });

  test('Live DOM: drop-shadow filter applied', async ({ page }) => {
    const elements = await page.locator('[class*="animate-muspel-pulse"]').all();

    // If elements exist, verify drop-shadow is in filter
    if (elements.length > 0) {
      const filter = await elements[0].evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).filter;
      });
      expect(filter).toContain('drop-shadow');
    }
  });

  test('Live DOM: ring--urgent also has animation', async ({ page }) => {
    const elements = await page.locator('.ring--urgent').all();

    if (elements.length > 0) {
      const animation = await elements[0].evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).animation;
      });
      expect(animation).toContain('muspel-pulse');
    }
  });
});
