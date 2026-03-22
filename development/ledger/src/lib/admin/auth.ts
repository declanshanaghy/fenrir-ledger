/**
 * Admin Auth — Fenrir Ledger
 *
 * Checks whether a verified user email is in the ADMIN_EMAILS whitelist.
 * ADMIN_EMAILS is a comma-separated list of Google email addresses stored
 * as a server-side-only env var (no NEXT_PUBLIC_ prefix).
 *
 * If ADMIN_EMAILS is not set or empty, all users are denied admin access.
 *
 * @module admin/auth
 */

import { log } from "@/lib/logger";

/**
 * Returns true if the given email is in the ADMIN_EMAILS whitelist.
 *
 * @param email - The verified Google email address to check
 * @returns true if the email is an admin, false otherwise
 */
export function isAdmin(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS;

  if (!raw || raw.trim() === "") {
    log.debug("isAdmin: ADMIN_EMAILS not set — denying all");
    return false;
  }

  const whitelist = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  const normalizedEmail = email.trim().toLowerCase();
  const result = whitelist.includes(normalizedEmail);

  log.debug("isAdmin check", {
    email: normalizedEmail,
    isAdmin: result,
    whitelistCount: whitelist.length,
  });

  return result;
}
