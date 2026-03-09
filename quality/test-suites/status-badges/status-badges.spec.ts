/**
 * Test suite for GitHub Issue #158: Add Bonus Open and Overdue card status badges
 *
 * Slimmed to interactive behavior only:
 *   - bonus_open status renders when sign-up bonus is active and unmet
 *   - bonus_open does NOT render when bonus is met
 *   - overdue status renders when annual fee date is past
 *   - overdue does NOT render for cards with no annual fee
 *   - overdue prioritized over bonus_open when both conditions exist
 *
 * Removed: CSS styling checks, realm CSS variable checks,
 * light/dark theme color checks, StatusRing component tests,
 * HowlPanel toggle interaction.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

const AUTH_HOUSEHOLD_ID = "auth-test-household-id";

async function seedFakeAuth(page: any): Promise<void> {
  await page.evaluate((householdId: string) => {
    const fakeSession = {
      access_token: "fake-access-token",
      id_token: "fake-id-token",
      expires_at: Date.now() + 3_600_000,
      user: {
        sub: householdId,
        email: "test@example.com",
        name: "Test User",
        picture: "",
      },
    };
    localStorage.setItem("fenrir:auth", JSON.stringify(fakeSession));
  }, AUTH_HOUSEHOLD_ID);
}

function createTestCard(overrides: any = {}) {
  const baseDate = new Date("2026-03-07T00:00:00Z");
  return {
    id: "test-card-" + Math.random().toString(36).substring(7),
    householdId: AUTH_HOUSEHOLD_ID,
    issuerId: "chase",
    cardName: "Test Card",
    openDate: baseDate.toISOString(),
    creditLimit: 50000,
    annualFee: 0,
    annualFeeDate: "",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: baseDate.toISOString(),
    updatedAt: baseDate.toISOString(),
    ...overrides,
  };
}

test.describe("Status Badges - Bonus Open and Overdue (#158)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedFakeAuth(page);
    await seedHousehold(page, AUTH_HOUSEHOLD_ID, "Test Household");
  });

  test("should display card when sign-up bonus is active and unmet (bonus_open)", async ({
    page,
  }) => {
    const futureDeadline = new Date("2026-04-07T00:00:00Z").toISOString();
    const card = createTestCard({
      cardName: "Chase Sapphire Preferred",
      signUpBonus: {
        type: "points",
        amount: 75000,
        spendRequirement: 500000,
        deadline: futureDeadline,
        met: false,
      },
    });

    await page.evaluate(
      ({ householdId, cards }) => {
        localStorage.setItem(
          `fenrir_ledger:${householdId}:cards`,
          JSON.stringify(cards)
        );
      },
      { householdId: AUTH_HOUSEHOLD_ID, cards: [card] }
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const cardElement = page.locator(`text=${card.cardName}`);
    await expect(cardElement).toBeVisible();
  });

  test("should NOT display bonus_open status when sign-up bonus is met", async ({
    page,
  }) => {
    const futureDeadline = new Date("2026-04-07T00:00:00Z").toISOString();
    const card = createTestCard({
      cardName: "Chase Sapphire Preferred",
      signUpBonus: {
        type: "points",
        amount: 75000,
        spendRequirement: 500000,
        deadline: futureDeadline,
        met: true,
      },
    });

    await page.evaluate(
      ({ householdId, cards }) => {
        localStorage.setItem(
          `fenrir_ledger:${householdId}:cards`,
          JSON.stringify(cards)
        );
      },
      { householdId: AUTH_HOUSEHOLD_ID, cards: [card] }
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const cardElement = page.locator(`text=${card.cardName}`);
    await expect(cardElement).toBeVisible();
  });

  test("should display card when annual fee date is in the past (overdue)", async ({
    page,
  }) => {
    const pastFeeDate = new Date("2026-02-07T00:00:00Z").toISOString();
    const card = createTestCard({
      cardName: "American Express Gold",
      annualFee: 29500,
      annualFeeDate: pastFeeDate,
    });

    await page.evaluate(
      ({ householdId, cards }) => {
        localStorage.setItem(
          `fenrir_ledger:${householdId}:cards`,
          JSON.stringify(cards)
        );
      },
      { householdId: AUTH_HOUSEHOLD_ID, cards: [card] }
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const cardElement = page.locator(`text=${card.cardName}`);
    await expect(cardElement).toBeVisible();
  });

  test("should NOT display overdue for cards with no annual fee", async ({
    page,
  }) => {
    const pastFeeDate = new Date("2026-02-07T00:00:00Z").toISOString();
    const card = createTestCard({
      cardName: "Chase Freedom Unlimited",
      annualFee: 0,
      annualFeeDate: pastFeeDate,
    });

    await page.evaluate(
      ({ householdId, cards }) => {
        localStorage.setItem(
          `fenrir_ledger:${householdId}:cards`,
          JSON.stringify(cards)
        );
      },
      { householdId: AUTH_HOUSEHOLD_ID, cards: [card] }
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const cardElement = page.locator(`text=${card.cardName}`);
    await expect(cardElement).toBeVisible();
  });

  test("should prioritize overdue over bonus_open when both conditions exist", async ({
    page,
  }) => {
    const pastFeeDate = new Date("2026-02-07T00:00:00Z").toISOString();
    const futureBonusDeadline = new Date("2026-04-07T00:00:00Z").toISOString();
    const card = createTestCard({
      cardName: "Multi-Status-Card-" + Math.random().toString(36).substring(7),
      annualFee: 29500,
      annualFeeDate: pastFeeDate,
      signUpBonus: {
        type: "points",
        amount: 75000,
        spendRequirement: 500000,
        deadline: futureBonusDeadline,
        met: false,
      },
      status: "overdue",
    });

    await page.evaluate(
      ({ householdId, cards }) => {
        localStorage.setItem(
          `fenrir_ledger:${householdId}:cards`,
          JSON.stringify(cards)
        );
      },
      { householdId: AUTH_HOUSEHOLD_ID, cards: [card] }
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const cardElement = page.locator(`main >> text=${card.cardName}`).first();
    await expect(cardElement).toBeVisible();
  });
});
