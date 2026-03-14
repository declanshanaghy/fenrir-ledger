/**
 * README Agent Profiles Validation Tests — Issue #800
 *
 * Verifies that the README redesign:
 * 1. Contains an ## Agent Profiles section (replacing removed Tech Stack sections)
 * 2. Includes all six agents with correct roles, rune glyphs, and ownership
 * 3. Links to all six profile images that actually exist on disk
 * 4. Contains Wikipedia lore links for each mythology reference
 * 5. Preserves preserved sections (Pipeline, Sacred Scrolls, Lineage, License)
 * 6. Does NOT contain the removed sections (Tech Stack, Project Structure, Getting Started)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const README_PATH = resolve(REPO_ROOT, "README.md");
const readmeContent = readFileSync(README_PATH, "utf-8");

// Extract the Agent Profiles section (from "## Agent Profiles" to next "##")
const agentProfilesSection =
  readmeContent.split("## Agent Profiles")[1]?.split(/\n## /)[0] ?? "";

describe("README Agent Profiles — Issue #800", () => {
  describe("Section Presence", () => {
    it("should contain ## Agent Profiles section", () => {
      expect(readmeContent).toContain("## Agent Profiles");
    });

    it("Agent Profiles section should not be empty", () => {
      expect(agentProfilesSection.trim().length).toBeGreaterThan(100);
    });
  });

  describe("Removed Sections (intentionally deleted by Issue #800)", () => {
    it("should NOT contain ## Tech Stack section", () => {
      expect(readmeContent).not.toContain("## Tech Stack");
    });

    it("should NOT contain ## Project Structure section", () => {
      expect(readmeContent).not.toContain("## Project Structure");
    });

    it("should NOT contain ## Getting Started section", () => {
      expect(readmeContent).not.toContain("## Getting Started");
    });
  });

  describe("Preserved Sections", () => {
    it("should contain ## The Pipeline section", () => {
      expect(readmeContent).toContain("## The Pipeline");
    });

    it("should contain Sacred Scrolls section", () => {
      expect(readmeContent).toContain("Sacred Scrolls");
    });

    it("should contain ## Lineage section", () => {
      expect(readmeContent).toContain("## Lineage");
    });

    it("should contain ## License section", () => {
      expect(readmeContent).toContain("## License");
    });
  });

  describe("All Six Agents Present", () => {
    const agents = [
      { name: "Odin", rune: "ᚨ", role: "Project Owner" },
      { name: "Freya", rune: "ᚠ", role: "Product Owner" },
      { name: "Luna", rune: "ᛚ", role: "UX Designer" },
      { name: "FiremanDecko", rune: "ᛞ", role: "Principal Engineer" },
      { name: "Loki", rune: "ᛏ", role: "QA Tester" },
      { name: "Heimdall", rune: "ᚺ", role: "Security Specialist" },
    ];

    it.each(agents)(
      "should include $name ($rune) with role $role",
      ({ name, rune, role }) => {
        expect(agentProfilesSection).toContain(name);
        expect(agentProfilesSection).toContain(rune);
        expect(agentProfilesSection).toContain(role);
      }
    );
  });

  describe("Agent Profile Images", () => {
    const profileImages = [
      ".claude/agents/profiles/odin-dark.png",
      ".claude/agents/profiles/freya-dark.png",
      ".claude/agents/profiles/luna-dark.png",
      ".claude/agents/profiles/fireman-decko-dark.png",
      ".claude/agents/profiles/loki-dark.png",
      ".claude/agents/profiles/heimdall-dark.png",
    ];

    it.each(profileImages)(
      "should reference %s and the file should exist on disk",
      (imgPath) => {
        expect(readmeContent).toContain(imgPath);
        expect(existsSync(resolve(REPO_ROOT, imgPath))).toBe(true);
      }
    );

    it("all profile <img> tags should have width=100 attribute", () => {
      const imgTags = agentProfilesSection.match(/<img[^>]+agents\/profiles[^>]+>/g) ?? [];
      expect(imgTags.length).toBeGreaterThanOrEqual(6);
      imgTags.forEach((tag) => {
        expect(tag).toContain('width="100"');
      });
    });

    it("all profile <img> tags should have alt text", () => {
      const imgTags = agentProfilesSection.match(/<img[^>]+agents\/profiles[^>]+>/g) ?? [];
      expect(imgTags.length).toBeGreaterThanOrEqual(6);
      imgTags.forEach((tag) => {
        expect(tag).toMatch(/alt="[^"]+"/);
      });
    });
  });

  describe("Weapon of Choice", () => {
    const weapons = [
      { agent: "Odin", weapon: "Gungnir" },
      { agent: "Freya", weapon: "Seiðr" },
      { agent: "Luna", weapon: "Moon" },
      { agent: "FiremanDecko", weapon: "Mjölnir" },
      { agent: "Loki", weapon: "Shape-Changer" },
      { agent: "Heimdall", weapon: "Gjallarhorn" },
    ];

    it.each(weapons)(
      "$agent should have a Weapon of Choice mentioning $weapon",
      ({ weapon }) => {
        expect(agentProfilesSection).toContain(weapon);
      }
    );
  });

  describe("Lore Links (Wikipedia)", () => {
    const wikiLinks = [
      "https://en.wikipedia.org/wiki/Odin",
      "https://en.wikipedia.org/wiki/Freyja",
      "https://en.wikipedia.org/wiki/Loki",
      "https://en.wikipedia.org/wiki/Heimdall",
      "https://en.wikipedia.org/wiki/Fenrir",
      "https://en.wikipedia.org/wiki/Ragnar%C3%B6k",
    ];

    it.each(wikiLinks)(
      "should include Wikipedia link to %s",
      (link) => {
        expect(agentProfilesSection).toContain(link);
      }
    );
  });

  describe("Domain Ownership in Agent Profiles", () => {
    it("Odin should own pack coordination", () => {
      expect(agentProfilesSection).toContain("product/");
      expect(agentProfilesSection).toContain("security/");
    });

    it("Freya should own product/product-design-brief.md", () => {
      expect(agentProfilesSection).toContain("product/product-design-brief.md");
    });

    it("Luna should own ux/wireframes/", () => {
      expect(agentProfilesSection).toContain("ux/wireframes/");
    });

    it("FiremanDecko should own development/frontend/", () => {
      expect(agentProfilesSection).toContain("development/frontend/");
    });

    it("Loki should own quality/test-suites/", () => {
      expect(agentProfilesSection).toContain("quality/test-suites/");
    });

    it("Heimdall should own security/reports/", () => {
      expect(agentProfilesSection).toContain("security/reports/");
    });
  });

  describe("Pipeline Diagram Integrity", () => {
    const pipelineSection =
      readmeContent.split("## The Pipeline")[1]?.split(/\n## /)[0] ?? "";

    it("Pipeline should contain a mermaid diagram", () => {
      expect(pipelineSection).toContain("```mermaid");
    });

    it("Pipeline should reference all five active agents", () => {
      expect(pipelineSection).toContain("Freya");
      expect(pipelineSection).toContain("Luna");
      expect(pipelineSection).toContain("FiremanDecko");
      expect(pipelineSection).toContain("Heimdall");
      expect(pipelineSection).toContain("Loki");
    });

    it("Pipeline should flow to 'Accepted' state", () => {
      expect(pipelineSection).toContain("Accepted");
    });
  });
});
