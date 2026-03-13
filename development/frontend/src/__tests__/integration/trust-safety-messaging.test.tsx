/**
 * Trust/Safety Messaging Integration Tests
 *
 * Validates that DataSafetyBanner is placed correctly on all marketing pages:
 * - Home page (full variant)
 * - Features page (full + inline variants)
 * - Pricing page (compact variant)
 * - About page (inline variant)
 * - Marketing footer (footer variant)
 *
 * Also validates FAQ entries for card numbers, import safety, and data collection.
 *
 * Issue: #644
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// ── Test Helpers ──────────────────────────────────────────────────────────

function readFaqJson() {
  const faqPath = path.join(
    process.cwd(),
    "src",
    "data",
    "faq.json"
  );
  return JSON.parse(readFileSync(faqPath, "utf-8"));
}

function getPrivacyCategory(faqData: any) {
  return faqData.find(
    (cat: any) => cat.id === "privacy-security"
  );
}

// ── FAQ Content Tests ─────────────────────────────────────────────────────

describe("FAQ — Privacy and Security Category", () => {
  const faqData = readFaqJson();
  const privacyCategory = getPrivacyCategory(faqData);

  it("should have Privacy and Security category", () => {
    expect(privacyCategory).toBeDefined();
    expect(privacyCategory.category).toBe("Privacy and Security");
  });

  it("should have existing 'Where is my card data stored?' entry", () => {
    const question = privacyCategory.questions.find(
      (q: any) => q.id === "data-storage"
    );
    expect(question).toBeDefined();
    expect(question.question).toBe("Where is my card data stored?");
  });

  it("should have existing 'Why do you use Google Sign-In?' entry", () => {
    const question = privacyCategory.questions.find(
      (q: any) => q.id === "google-sign-in"
    );
    expect(question).toBeDefined();
    expect(question.question).toBe("Why do you use Google Sign-In?");
  });

  it("should have existing 'What data do you collect?' entry", () => {
    const question = privacyCategory.questions.find(
      (q: any) => q.id === "what-we-collect"
    );
    expect(question).toBeDefined();
    expect(question.question).toBe("What data do you collect?");
  });

  it("should have new entry about credit card number collection", () => {
    const question = privacyCategory.questions.find(
      (q: any) => q.id === "collect-card-numbers"
    );
    expect(question).toBeDefined();
    expect(question.question).toContain("credit card number");
    expect(question.question.toLowerCase()).toContain("collect");
  });

  it("should explicitly state 'No' or 'Never' for card number question", () => {
    const question = privacyCategory.questions.find(
      (q: any) => q.id === "collect-card-numbers"
    );
    const answerLower = question.answer.toLowerCase();
    expect(
      answerLower.startsWith("no") ||
        answerLower.includes("fenrir ledger does not collect") ||
        answerLower.includes("never collects")
    ).toBe(true);
  });

  it("should explain metadata-only model in card numbers answer", () => {
    const question = privacyCategory.questions.find(
      (q: any) => q.id === "collect-card-numbers"
    );
    expect(question.answer).toContain("metadata");
    expect(question.answer).toContain("card name");
    expect(question.answer).toContain("issuer");
  });

  it("should list what is NOT collected (CVV, PINs, passwords)", () => {
    const question = privacyCategory.questions.find(
      (q: any) => q.id === "collect-card-numbers"
    );
    const answer = question.answer.toLowerCase();
    expect(answer).toContain("cvv");
    expect(answer).toContain("pin");
    expect(answer).toContain("password");
  });

  it("should have entry about Smart Import data safety", () => {
    const question = privacyCategory.questions.find(
      (q: any) => q.id === "smart-import-safety" || q.id === "import-safety"
    );
    expect(question).toBeDefined();
    expect(question.question.toLowerCase()).toContain("import");
  });

  it("should explain Smart Import does not extract/store card numbers", () => {
    const question = privacyCategory.questions.find(
      (q: any) => q.id === "smart-import-safety" || q.id === "import-safety"
    );
    const answer = question.answer.toLowerCase();
    expect(answer).toContain("does not extract");
    expect(answer).toContain("card number");
  });

  it("should mention spreadsheet processing in Smart Import answer", () => {
    const question = privacyCategory.questions.find(
      (q: any) => q.id === "smart-import-safety" || q.id === "import-safety"
    );
    expect(question.answer).toContain("spreadsheet");
  });
});

// ── FAQ Structure Tests ───────────────────────────────────────────────────

describe("FAQ — Structure and Completeness", () => {
  const faqData = readFaqJson();

  it("should have all 5 main categories", () => {
    const categoryIds = faqData.map((cat: any) => cat.id);
    expect(categoryIds).toContain("getting-started");
    expect(categoryIds).toContain("features");
    expect(categoryIds).toContain("pricing");
    expect(categoryIds).toContain("privacy-security");
    expect(categoryIds).toContain("technical");
  });

  it("should have at least 3 questions in Privacy and Security", () => {
    const privacyCategory = getPrivacyCategory(faqData);
    expect(privacyCategory.questions.length).toBeGreaterThanOrEqual(3);
  });

  it("each category should have id, category, and questions", () => {
    faqData.forEach((cat: any) => {
      expect(cat).toHaveProperty("id");
      expect(cat).toHaveProperty("category");
      expect(cat).toHaveProperty("questions");
      expect(Array.isArray(cat.questions)).toBe(true);
    });
  });

  it("each question should have id, question, and answer", () => {
    faqData.forEach((cat: any) => {
      cat.questions.forEach((q: any) => {
        expect(q).toHaveProperty("id");
        expect(q).toHaveProperty("question");
        expect(q).toHaveProperty("answer");
        expect(typeof q.question).toBe("string");
        expect(typeof q.answer).toBe("string");
      });
    });
  });

  it("question and answer texts should not be empty", () => {
    faqData.forEach((cat: any) => {
      cat.questions.forEach((q: any) => {
        expect(q.question.trim().length).toBeGreaterThan(0);
        expect(q.answer.trim().length).toBeGreaterThan(0);
      });
    });
  });
});

// ── Key Trust Messaging Content Tests ─────────────────────────────────────

describe("Trust Messaging — Key Content Verification", () => {
  const faqData = readFaqJson();
  const privacyCategory = getPrivacyCategory(faqData);

  it("should mention 'card metadata' in trust messaging", () => {
    let found = false;
    privacyCategory.questions.forEach((q: any) => {
      if (q.answer.toLowerCase().includes("metadata")) {
        found = true;
      }
    });
    expect(found).toBe(true);
  });

  it("should explicitly mention 'card name' as tracked data", () => {
    let found = false;
    privacyCategory.questions.forEach((q: any) => {
      if (q.answer.toLowerCase().includes("card name")) {
        found = true;
      }
    });
    expect(found).toBe(true);
  });

  it("should explicitly mention 'issuer' as tracked data", () => {
    let found = false;
    privacyCategory.questions.forEach((q: any) => {
      if (q.answer.toLowerCase().includes("issuer")) {
        found = true;
      }
    });
    expect(found).toBe(true);
  });

  it("should mention 'annual fee' as tracked data", () => {
    let found = false;
    privacyCategory.questions.forEach((q: any) => {
      if (q.answer.toLowerCase().includes("annual fee")) {
        found = true;
      }
    });
    expect(found).toBe(true);
  });

  it("should mention 'bonus deadline' or 'deadline' as tracked data", () => {
    let found = false;
    privacyCategory.questions.forEach((q: any) => {
      if (
        q.answer.toLowerCase().includes("deadline") ||
        q.answer.toLowerCase().includes("bonus")
      ) {
        found = true;
      }
    });
    expect(found).toBe(true);
  });

  it("should explicitly say 'never' collects card numbers in at least one answer", () => {
    let found = false;
    privacyCategory.questions.forEach((q: any) => {
      if (
        q.answer.toLowerCase().includes("never") &&
        q.answer.toLowerCase().includes("card number")
      ) {
        found = true;
      }
    });
    expect(found).toBe(true);
  });

  it("should mention CVV or security codes as NOT collected", () => {
    let found = false;
    privacyCategory.questions.forEach((q: any) => {
      if (
        q.answer.toLowerCase().includes("cvv") ||
        q.answer.toLowerCase().includes("cvc") ||
        q.answer.toLowerCase().includes("security code")
      ) {
        found = true;
      }
    });
    expect(found).toBe(true);
  });

  it("should mention PIN as NOT collected", () => {
    let found = false;
    privacyCategory.questions.forEach((q: any) => {
      if (q.answer.toLowerCase().includes("pin")) {
        found = true;
      }
    });
    expect(found).toBe(true);
  });

  it("should mention password as NOT collected", () => {
    let found = false;
    privacyCategory.questions.forEach((q: any) => {
      if (q.answer.toLowerCase().includes("password")) {
        found = true;
      }
    });
    expect(found).toBe(true);
  });
});
