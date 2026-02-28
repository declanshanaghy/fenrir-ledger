/**
 * Fenrir Ledger — Auth.js v5 Configuration
 *
 * Authentication provider: Google OAuth 2.0.
 * Session strategy: JWT (stateless) stored in an HttpOnly cookie.
 * No server-side session store required.
 *
 * householdId is derived from the Google `sub` claim and embedded in both
 * the JWT and the session object. This is the stable identifier used to
 * namespace all localStorage keys per authenticated user.
 *
 * See ADR-004 for the full auth architecture decision.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    /**
     * JWT callback — runs when a token is created or updated.
     * On initial sign-in, embeds the Google `sub` claim as `householdId`.
     * On subsequent requests, the token already carries `householdId`.
     */
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // Initial sign-in: embed the stable Google account ID as householdId.
        // profile.sub is the Google account's immutable unique identifier.
        token.householdId = profile.sub ?? token.sub ?? "";
      }
      // On subsequent JWT refreshes, householdId is already on the token.
      return token;
    },

    /**
     * Session callback — shapes the session object returned by auth() and useSession().
     * Surfaces householdId so pages and components can use it directly.
     */
    async session({ session, token }) {
      session.user.householdId = (token.householdId as string) ?? (token.sub ?? "");
      return session;
    },
  },
});
