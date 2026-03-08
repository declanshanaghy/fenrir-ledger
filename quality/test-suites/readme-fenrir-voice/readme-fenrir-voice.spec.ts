import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('README Fenrir Voice & Runes Validation', () => {
  let readmeContent: string;

  test.beforeAll(() => {
    const readmePath = '/workspace/README.md';
    readmeContent = fs.readFileSync(readmePath, 'utf-8');
  });

  // ===== Rune Validation =====

  test('should contain Elder Futhark rune ᚠ (Product - Freya)', () => {
    expect(readmeContent).toContain('ᚠ');
    // Verify it appears near "Product" section
    expect(readmeContent).toContain('ᚠ | **Product**');
  });

  test('should contain Elder Futhark rune ᛚ (UX - Luna)', () => {
    expect(readmeContent).toContain('ᛚ');
    // Verify it appears in UX section
    expect(readmeContent).toContain('ᛚ | **UX**');
  });

  test('should contain Elder Futhark rune ᛞ (Architecture - FiremanDecko)', () => {
    expect(readmeContent).toContain('ᛞ');
    // Verify it appears in Architecture section
    expect(readmeContent).toContain('ᛞ | **Architecture**');
  });

  test('should contain Elder Futhark rune ᚺ (Security - Heimdall)', () => {
    expect(readmeContent).toContain('ᚺ');
    // Verify it appears in Security section
    expect(readmeContent).toContain('ᚺ | **Security**');
  });

  test('should contain Elder Futhark rune ᛏ (Quality - Loki)', () => {
    expect(readmeContent).toContain('ᛏ');
    // Verify it appears in Quality section
    expect(readmeContent).toContain('ᛏ | **Quality**');
  });

  test('should contain Elder Futhark rune ᛟ (Operations)', () => {
    expect(readmeContent).toContain('ᛟ');
    // Verify it appears in Operations section
    expect(readmeContent).toContain('ᛟ | **Operations**');
  });

  // ===== Header Validation =====

  test('should have correct section header with runes', () => {
    // Should contain "ᚱ Key Documentation ᚢᚾᛖᛋ" as section header
    expect(readmeContent).toContain('ᚱ Key Documentation ᚢᚾᛖᛋ');
  });

  // ===== Agent Voice Validation =====

  test('should contain Freya voice in Product link descriptions', () => {
    expect(readmeContent).toContain('The vision I have laid before the pack');
    expect(readmeContent).toContain('My counsel to the forge-master');
    expect(readmeContent).toContain('The hunts I have ordered by urgency');
  });

  test('should contain Luna voice in UX link descriptions', () => {
    expect(readmeContent).toContain('The runes of color and shadow I have woven');
    expect(readmeContent).toContain('Bones of every screen, drawn before steel is poured');
    expect(readmeContent).toContain('How the wolf moves when touched');
  });

  test('should contain FiremanDecko voice in Architecture link descriptions', () => {
    expect(readmeContent).toContain('The load-bearing bones of this hall');
    expect(readmeContent).toContain('Every decision forged in fire, never undone lightly');
    expect(readmeContent).toContain('The channel through which all work flows');
    expect(readmeContent).toContain('Why Depot carries our iron');
  });

  test('should contain Heimdall voice in Security link descriptions', () => {
    expect(readmeContent).toContain('I see all nine worlds; nothing passes unwatched');
    expect(readmeContent).toContain('The reckoning of keys and scopes I have audited');
  });

  test('should contain Loki voice in Quality link descriptions', () => {
    expect(readmeContent).toContain('Every trap I have laid to catch the careless');
    expect(readmeContent).toContain('My verdict on what stands and what crumbles');
    expect(readmeContent).toContain('The chaos I have scheduled, in order');
  });

  // ===== Link Accuracy Validation =====

  test('should have valid Product Brief link', () => {
    expect(readmeContent).toContain('[Product Brief](product-brief.md)');
  });

  test('should have valid Design Brief link', () => {
    expect(readmeContent).toContain('[Design Brief](product/product-design-brief.md)');
  });

  test('should have valid Backlog link', () => {
    expect(readmeContent).toContain('[Backlog](product/backlog/README.md)');
  });

  test('should have valid Theme System link', () => {
    expect(readmeContent).toContain('[Theme System](ux/theme-system.md)');
  });

  test('should have valid Wireframes link', () => {
    expect(readmeContent).toContain('[Wireframes](ux/wireframes.md)');
  });

  test('should have valid Interactions link', () => {
    expect(readmeContent).toContain('[Interactions](ux/interactions.md)');
  });

  test('should have valid System Design link', () => {
    expect(readmeContent).toContain('[System Design](architecture/system-design.md)');
  });

  test('should have valid ADRs link', () => {
    expect(readmeContent).toContain('[ADRs](architecture/adrs/)');
  });

  test('should have valid Pipeline link', () => {
    expect(readmeContent).toContain('[Pipeline](architecture/pipeline.md)');
  });

  test('should have valid Remote Builders ADR link', () => {
    expect(readmeContent).toContain('[Remote Builders (ADR-007)](architecture/adrs/ADR-007-remote-builder-platforms.md)');
  });

  test('should have valid Security Index link', () => {
    expect(readmeContent).toContain('[Security Index](security/README.md)');
  });

  test('should have valid Google API Review link', () => {
    expect(readmeContent).toContain('[Google API Review](security/reports/2026-03-02-google-api-integration.md)');
  });

  test('should have valid Test Suites link', () => {
    expect(readmeContent).toContain('[Test Suites](quality/test-suites/)');
  });

  test('should have valid Quality Report link', () => {
    expect(readmeContent).toContain('[Quality Report](quality/quality-report.md)');
  });

  test('should have valid Test Plan link', () => {
    expect(readmeContent).toContain('[Test Plan](quality/test-plan.md)');
  });

  test('should have valid Git Convention link', () => {
    expect(readmeContent).toContain('[Git Convention](.claude/skills/git-commit/SKILL.md)');
  });

  test('should have valid Mermaid Guide link', () => {
    expect(readmeContent).toContain('[Mermaid Guide](ux/ux-assets/mermaid-style-guide.md)');
  });

  test('should have valid Depot Setup link', () => {
    expect(readmeContent).toContain('[Depot Setup](.claude/scripts/depot-setup.sh)');
  });

  test('should have valid Fire Next Up link', () => {
    expect(readmeContent).toContain('[Fire Next Up](.claude/skills/fire-next-up/SKILL.md)');
  });

  // ===== Readability Validation =====

  test('should maintain readable table structure', () => {
    // Check that rune column exists and table is properly formatted
    expect(readmeContent).toContain('| ᚱᚢᚾᛖ | Domain | Sacred Scrolls |');
  });

  test('should not have broken pipe characters in table', () => {
    // Extract the Key Documentation section
    const keyDocStart = readmeContent.indexOf('## ᚱ Key Documentation ᚢᚾᛖᛋ');
    const keyDocEnd = readmeContent.indexOf('---', keyDocStart + 100);
    const keyDocSection = readmeContent.substring(keyDocStart, keyDocEnd);

    // Count pipes - should be in multiples of 3 per row (3 columns)
    const rows = keyDocSection.split('\n').filter(line => line.includes('|'));
    rows.forEach(row => {
      const pipeCount = (row.match(/\|/g) || []).length;
      // Each row should have 4 pipes (start, 3 columns, end)
      expect(pipeCount).toBe(4);
    });
  });

  // ===== Acceptance Criteria =====

  test('acceptance criteria: Key Documentation section has Elder Futhark runes', () => {
    // AC: README Key Documentation uses Elder Futhark runes
    const runesPresent =
      readmeContent.includes('ᚱ') &&
      readmeContent.includes('ᛚ') &&
      readmeContent.includes('ᛞ') &&
      readmeContent.includes('ᚺ') &&
      readmeContent.includes('ᛏ') &&
      readmeContent.includes('ᛟ');

    expect(runesPresent).toBe(true);
  });

  test('acceptance criteria: Agent voices in link descriptions', () => {
    // AC: Agent voice in link descriptions (Freya, Luna, FiremanDecko, Heimdall, Loki)
    const freyadVoice = readmeContent.includes('Freya speaks');
    const lunaVoice = readmeContent.includes('Luna shapes');
    const firemandeckoVoice = readmeContent.includes('FiremanDecko engineers');
    const heimdallVoice = readmeContent.includes('Heimdall watches');
    const lokiVoice = readmeContent.includes('Loki tests');

    expect(freyadVoice && lunaVoice && firemandeckoVoice && heimdallVoice && lokiVoice).toBe(true);
  });

  test('acceptance criteria: Links are accurate and readable', () => {
    // AC: Links accurate and readable
    // Verify no broken markdown links
    const brokenLinksPattern = /\[\s*\]\([^)]*\)|\[[^\]]*\]\(\s*\)/g;
    const brokenLinks = readmeContent.match(brokenLinksPattern);

    expect(brokenLinks).toBeNull();

    // Verify all file paths exist or are reasonable
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    const links = [];

    while ((match = linkPattern.exec(readmeContent)) !== null) {
      const [, text, url] = match;
      // Reasonable link should not be empty
      expect(text).not.toBe('');
      expect(url).not.toBe('');
      links.push({ text, url });
    }

    // Should have found many links
    expect(links.length).toBeGreaterThan(10);
  });
});
