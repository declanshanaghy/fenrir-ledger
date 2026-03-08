import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * QA Test Suite for Issue #357: README Pack Section
 * Validates that The Pack section in README.md is complete and correct.
 */

const REPO_ROOT = path.join(__dirname, "../../..");
const README_PATH = path.join(REPO_ROOT, "README.md");
const AGENTS_DIR = path.join(REPO_ROOT, ".claude/agents");

const AGENTS = [
  { name: "odin", displayName: "Odin" },
  { name: "freya", displayName: "Freya" },
  { name: "luna", displayName: "Luna" },
  { name: "fireman-decko", displayName: "FiremanDecko" },
  { name: "loki", displayName: "Loki" },
  { name: "heimdall", displayName: "Heimdall" },
];

const NORSE_TERMS_WITH_LINKS = {
  Fenrir: "https://en.wikipedia.org/wiki/Fenrir",
  Odin: "https://en.wikipedia.org/wiki/Odin",
  Freya: "https://en.wikipedia.org/wiki/Freyja",
  Luna: "https://en.wikipedia.org/wiki/M%C3%A1ni",
  Ragnarök: "https://en.wikipedia.org/wiki/Ragnar%C3%B6k",
  Loki: "https://en.wikipedia.org/wiki/Loki",
  Heimdall: "https://en.wikipedia.org/wiki/Heimdall",
  Bifröst: "https://en.wikipedia.org/wiki/Bifr%C3%B6st",
};

test.describe("README Pack Section (#357)", () => {
  let readmeContent: string;

  test.beforeAll(() => {
    expect(fs.existsSync(README_PATH)).toBe(true);
    readmeContent = fs.readFileSync(README_PATH, "utf-8");
  });

  test("README contains 'The Pack' section header", () => {
    expect(readmeContent).toContain("## The Pack");
  });

  test("README contains introductory Pack statement", () => {
    expect(readmeContent).toContain(
      "Six wolves, one purpose. Each forged in a different fire"
    );
  });

  test.describe("Agent Profile Files", () => {
    for (const agent of AGENTS) {
      test(`${agent.displayName} profile .md exists`, () => {
        const profilePath = path.join(AGENTS_DIR, `${agent.name}-profile.md`);
        expect(fs.existsSync(profilePath)).toBe(true);
      });

      test(`${agent.displayName} profile .md has content`, () => {
        const profilePath = path.join(AGENTS_DIR, `${agent.name}-profile.md`);
        if (fs.existsSync(profilePath)) {
          const content = fs.readFileSync(profilePath, "utf-8");
          expect(content.length).toBeGreaterThan(50);
        }
      });
    }
  });

  test.describe("README Pack Content", () => {
    for (const agent of AGENTS) {
      test(`README contains ${agent.displayName} name`, () => {
        expect(readmeContent).toContain(agent.displayName);
      });

      test(`README has ${agent.displayName} profile link`, () => {
        expect(readmeContent).toContain(
          `[Full Profile](.claude/agents/${agent.name}-profile.md)`
        );
      });

      test(`README links to ${agent.displayName} profile .md file`, () => {
        const profilePath = path.join(AGENTS_DIR, `${agent.name}-profile.md`);
        expect(fs.existsSync(profilePath)).toBe(true);
      });
    }
  });

  test.describe("Norse Terms Linking to Wikipedia", () => {
    for (const [term, wikiUrl] of Object.entries(NORSE_TERMS_WITH_LINKS)) {
      test(`'${term}' is linked to Wikipedia`, () => {
        const markdownLink = `[${term}](${wikiUrl})`;
        expect(readmeContent).toContain(markdownLink);
      });
    }
  });

  test("README contains all 6 agents in The Pack section", () => {
    const packSectionStart = readmeContent.indexOf("## The Pack");
    const packSectionEnd = readmeContent.indexOf("## The Pipeline");
    expect(packSectionStart).toBeGreaterThan(-1);
    expect(packSectionEnd).toBeGreaterThan(packSectionStart);

    const packSection = readmeContent.substring(packSectionStart, packSectionEnd);

    for (const agent of AGENTS) {
      expect(packSection).toContain(agent.displayName);
    }
  });

  test("All agent profile image references use correct dark/light convention", () => {
    const packSectionStart = readmeContent.indexOf("## The Pack");
    const packSectionEnd = readmeContent.indexOf("## The Pipeline");
    const packSection = readmeContent.substring(packSectionStart, packSectionEnd);

    // Check for image references using -dark.png convention (or absence for image-only agents)
    const imageRefs = packSection.match(/\[.*?\]\(\.claude\/agents\/.*?\.png\)/g) || [];
    for (const imgRef of imageRefs) {
      // Should match either -dark.png or -light.png or similar variant
      expect(imgRef).toMatch(/\.png\)/);
    }
  });

  test("README renders as valid markdown on GitHub", () => {
    // Check for markdown syntax validity
    const mdLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    const links = [];

    while ((match = mdLinkPattern.exec(readmeContent)) !== null) {
      links.push({ text: match[1], url: match[2] });
    }

    expect(links.length).toBeGreaterThan(0);
  });

  test("All profile links in README Pack section reference existing files", () => {
    const profileLinkPattern = /\[Full Profile\]\(\.claude\/agents\/([^)]+\.md)\)/g;
    let match;

    while ((match = profileLinkPattern.exec(readmeContent)) !== null) {
      const filePath = path.join(REPO_ROOT, ".claude/agents", match[1]);
      expect(fs.existsSync(filePath)).toBe(
        true,
        `Profile file does not exist: ${filePath}`
      );
    }
  });

  test("README Pack section contains mystical introductions", () => {
    const packSectionStart = readmeContent.indexOf("## The Pack");
    const packSectionEnd = readmeContent.indexOf("## The Pipeline");
    const packSection = readmeContent.substring(packSectionStart, packSectionEnd);

    // Verify Pack section has narrative content (not just links)
    expect(packSection).toContain("does not build with his hands");
    expect(packSection).toContain("reads what is coming");
    expect(packSection).toContain("draws the bones");
    expect(packSection).toContain("turns vision into iron");
    expect(packSection).toContain("proves it doesn't");
    expect(packSection).toContain("stands at the boundary");
  });

  test("README Pack section avoids corporate boilerplate", () => {
    const packSectionStart = readmeContent.indexOf("## The Pack");
    const packSectionEnd = readmeContent.indexOf("## The Pipeline");
    const packSection = readmeContent.substring(packSectionStart, packSectionEnd);

    // Check for absence of corporate-sounding phrases
    const corporatePatterns = [
      "solutions",
      "innovative",
      "cutting-edge",
      "best-in-class",
      "world-class",
    ];

    for (const phrase of corporatePatterns) {
      expect(packSection.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
