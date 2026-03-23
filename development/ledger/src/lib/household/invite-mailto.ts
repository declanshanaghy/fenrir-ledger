/**
 * invite-mailto — builds a mailto: URL for household invite sharing.
 *
 * The email body rotates through a pool of Norse-themed Fenrir Ledger intros,
 * appends the invite code prominently, and includes step-by-step join instructions.
 *
 * Issue #1793
 */

export const INVITE_INTRO_POOL: readonly string[] = [
  "I use Fenrir Ledger to track my credit card annual fees, bonus deadlines, and downgrade windows.",
  "Fenrir Ledger is a credit card tracking tool — it watches your annual fee dates, signup bonus deadlines, and promo expiration windows.",
  "I track all my cards with Fenrir Ledger. It's built for churners — tracks fee dates, bonus spend windows, and tells you when to downgrade or cancel.",
  "Fenrir Ledger keeps me on top of every card deadline — annual fees, sign-up bonuses, and promo periods — all in one place.",
  "I've been using Fenrir Ledger to stay ahead of my card portfolio. It tracks every fee date, bonus window, and cancellation deadline.",
  "Fenrir Ledger is the app I use to manage my credit card strategy — annual fees, bonus timelines, and downgrade reminders, all tracked automatically.",
];

const JOIN_INSTRUCTIONS = `Here's how to join my household on Fenrir Ledger:

1. Go to fenrirledger.com
2. Sign up or sign in
3. Go to Settings > Household
4. Click "Join a Household"
5. Enter the invite code below`;

/**
 * Picks a random intro from the pool.
 * Exported for testability — pass a custom `random` to override.
 */
export function pickRandomIntro(
  pool: readonly string[] = INVITE_INTRO_POOL,
  random: () => number = Math.random,
): string {
  return pool[Math.floor(random() * pool.length)] ?? pool[0] ?? "";
}

/**
 * Builds the mailto: URL for an invite email.
 *
 * Subject: "Join my Fenrir Ledger household"
 * Body: random intro + join instructions + invite code
 *
 * Recipient is pre-filled with a placeholder (your-friend@example.com) so
 * email clients open correctly — the user replaces it with the real address.
 */
export function buildInviteMailtoUrl(
  inviteCode: string,
  options?: { random?: () => number; pool?: readonly string[] },
): string {
  const intro = pickRandomIntro(options?.pool, options?.random);

  const body = [
    intro,
    "",
    JOIN_INSTRUCTIONS,
    "",
    `Invite code: ${inviteCode}`,
  ].join("\n");

  const subject = "Join my Fenrir Ledger household";

  return `mailto:your-friend@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
