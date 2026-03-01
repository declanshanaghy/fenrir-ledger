/**
 * Auth.js v5 — Type augmentations for Fenrir Ledger
 *
 * Extends Session and User types to include the `householdId` field
 * derived from the Google `sub` claim. Placed at the project root
 * so TypeScript picks it up via the tsconfig include patterns.
 *
 * In Auth.js v5 (next-auth@beta), canonical session types live in
 * @auth/core/types and are re-exported by next-auth.
 */

declare module "@auth/core/types" {
  /**
   * Augment the Session interface so that session.user.householdId is typed
   * correctly everywhere useSession() or auth() is called.
   */
  interface Session {
    user: {
      /** Stable Google account ID (sub claim). Used as the localStorage namespace key. */
      householdId: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  /**
   * Augment User so that householdId is typed in auth callbacks.
   */
  interface User {
    /** Stable Google account ID (sub claim). Used as the localStorage namespace key. */
    householdId?: string;
  }
}

declare module "next-auth/jwt" {
  /**
   * Augment JWT so that token.householdId is typed in the jwt() callback.
   */
  interface JWT {
    /** Stable Google account ID (sub claim) embedded at initial sign-in. */
    householdId?: string;
  }
}

export {};
