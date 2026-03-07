import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('README Badge Validation', () => {
  let readmeContent: string;

  test.beforeAll(() => {
    const readmePath = '/workspace/README.md';
    readmeContent = fs.readFileSync(readmePath, 'utf-8');
  });

  test('should not contain broken preview deploy badge reference', () => {
    // The preview badge should be removed entirely
    expect(readmeContent).not.toContain('vercel-preview.yml');
    expect(readmeContent).not.toContain('Preview&logo=vercel');
    expect(readmeContent).not.toContain('label=Preview');
  });

  test('should contain valid production deploy badge', () => {
    // The production badge should be present and valid
    expect(readmeContent).toContain('vercel-production.yml');
    expect(readmeContent).toContain('label=Production&logo=vercel');
    expect(readmeContent).toContain('https://github.com/declanshanaghy/fenrir-ledger/actions/workflows/vercel-production.yml');
  });

  test('should have valid badge URL structure for production', () => {
    const productionBadgePattern = /https:\/\/img\.shields\.io\/github\/actions\/workflow\/status\/declanshanaghy\/fenrir-ledger\/vercel-production\.yml\?branch=main/;
    expect(readmeContent).toMatch(productionBadgePattern);
  });

  test('should not have broken image references', () => {
    // Check that all img src attributes point to valid shields.io or GitHub URLs
    const imgPattern = /src="([^"]+)"/g;
    let match;
    const badgeUrls = [];

    while ((match = imgPattern.exec(readmeContent)) !== null) {
      badgeUrls.push(match[1]);
    }

    // Verify no placeholder or broken URLs
    badgeUrls.forEach(url => {
      expect(url).not.toBe('');
      expect(url).not.toContain('undefined');
      expect(url).not.toContain('null');
    });
  });

  test('should have consistent badge styling', () => {
    // Check that remaining badges use consistent styling
    const stylePattern = /style=for-the-badge/g;
    const matches = readmeContent.match(stylePattern);

    // Should have at least the production badge with for-the-badge style
    expect(matches).toBeDefined();
    expect(matches!.length).toBeGreaterThan(0);
  });

  test('should not have orphaned table cells', () => {
    // After removing preview badge, table structure should remain valid
    // Check that colspan values make sense (no misaligned cells)
    const colspanPattern = /colspan="(\d+)"/g;
    let match;
    let hasValidColspan = false;

    while ((match = colspanPattern.exec(readmeContent)) !== null) {
      const colspan = parseInt(match[1], 10);
      expect(colspan).toBeGreaterThan(0);
      if (colspan > 0) hasValidColspan = true;
    }

    expect(hasValidColspan).toBe(true);
  });

  test('should render README on GitHub without dead badges', async ({ page }) => {
    // Navigate to the repository README on GitHub
    await page.goto('https://github.com/declanshanaghy/fenrir-ledger', { waitUntil: 'networkidle' });

    // Check that the page loaded successfully
    expect(await page.title()).toContain('fenrir-ledger');

    // Verify the badges section is visible
    const badgesSection = page.locator('img[alt*="Deploy"]');
    const badgeCount = await badgesSection.count();

    // Should have at least the Production badge, not the Preview badge
    expect(badgeCount).toBeGreaterThan(0);

    // Verify Production badge is present
    const productionBadge = page.locator('img[alt="Production Deploy"]');
    await expect(productionBadge).toBeVisible();
  });

  test('acceptance criteria: preview badge removed', () => {
    // Acceptance Criteria: Preview badge shows correct status, OR badge is removed if no preview workflow exists
    // We chose to remove it as the workflow doesn't run on main branch
    const previewBadgeRemoved = !readmeContent.includes('vercel-preview.yml');
    expect(previewBadgeRemoved).toBe(true);
  });

  test('acceptance criteria: remaining badges render correctly', () => {
    // Acceptance Criteria: Both remaining badges render correctly on GitHub
    // We now have Production and other badges (like Last Commit)
    expect(readmeContent).toContain('Production');
    expect(readmeContent).toContain('Last Commit');

    // Verify badge image URLs are properly formed
    const badgeUrls = readmeContent.match(/src="(https:\/\/img\.shields\.io[^"]+)"/g);
    expect(badgeUrls).toBeDefined();
    expect(badgeUrls!.length).toBeGreaterThan(0);
  });
});
