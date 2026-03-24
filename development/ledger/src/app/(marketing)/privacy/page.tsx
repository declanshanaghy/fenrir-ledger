/**
 * Privacy Policy page — /privacy
 *
 * Migrated from public/static/privacy.html into a Next.js server component.
 * Uses the (marketing) layout (nav + footer) via MarketingLayout.
 *
 * Static export: force-static so this page is pre-rendered at build time.
 */

import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Fenrir Ledger collects, uses, and protects your information.",
};

// ── Shared prose classes ─────────────────────────────────────────────────────

const prose =
  "max-w-3xl mx-auto px-4 pt-10 pb-20 font-body text-foreground leading-relaxed";

const h2Class =
  "font-heading text-xl text-gold mt-10 mb-2 pb-1 border-b border-border";

const h3Class = "font-heading text-base text-foreground mt-6 mb-1";

const pClass = "mb-3 text-foreground/90";

const liClass = "mb-2";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  return (
    <article className={prose}>
      <h1 className="font-display text-3xl text-gold mb-1">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last Updated: March 3, 2026</p>

      <p className={pClass}>
        Your privacy is important to us. Fenrir Ledger is a credit card rewards tracker
        that is designed to keep your data under your control. This Privacy Policy explains
        what information we collect, how we use it, and your choices.
      </p>

      {/* 1 */}
      <h2 className={h2Class}>1. Who We Are</h2>
      <p className={pClass}>
        Fenrir Ledger is a source-available web application for tracking credit card signup
        bonuses, annual fees, and reward milestones. The service is operated by
        Declan Shanaghy (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). You can reach us at{" "}
        <a
          href="mailto:privacy@fenrirledger.com"
          className="text-gold underline hover:brightness-110 transition-colors"
        >
          privacy@fenrirledger.com
        </a>
        .
      </p>

      {/* 2 */}
      <h2 className={h2Class}>2. Information We Collect</h2>

      <h3 className={h3Class}>Information You Provide</h3>
      <ul className="list-disc pl-6 mb-4">
        <li className={liClass}>
          <strong>Account information:</strong> When you sign in with Google, we receive
          your name, email address, and profile picture from Google&rsquo;s OAuth service. We use
          this solely to authenticate you.
        </li>
        <li className={liClass}>
          <strong>Card and financial tracking data:</strong> Credit card names, issuers,
          annual fees, bonus targets, and related data you enter into the application.{" "}
          <strong>
            This data is stored locally in your browser (localStorage) and is not
            transmitted to our servers.
          </strong>
        </li>
      </ul>

      <h3 className={h3Class}>Information Collected Automatically</h3>
      <ul className="list-disc pl-6 mb-4">
        <li className={liClass}>
          <strong>Analytics data:</strong> We use analytics services to understand how
          the application is used. This may include pages visited, features used, browser
          type, device type, approximate location (country/region derived from IP address),
          and referral source. We do not use analytics to identify you personally.
        </li>
        <li className={liClass}>
          <strong>Server logs:</strong> Our hosting provider (Vercel) may collect standard
          server logs including IP addresses, request timestamps, and HTTP headers. These
          are retained per Vercel&rsquo;s data retention policies.
        </li>
      </ul>

      <h3 className={h3Class}>Information from Third Parties</h3>
      <ul className="list-disc pl-6 mb-4">
        <li className={liClass}>
          <strong>Google OAuth:</strong> Name, email address, and profile picture when
          you sign in.
        </li>
        <li className={liClass}>
          <strong>Google Sheets / Drive:</strong> If you use the import feature, we
          access spreadsheet data you explicitly select via Google Picker. We read the
          data to extract card information and do not store your Google Drive files.
        </li>
      </ul>

      {/* 3 */}
      <h2 className={h2Class}>3. How We Use Your Information</h2>
      <ul className="list-disc pl-6 mb-4">
        <li className={liClass}>Authenticate you and maintain your session</li>
        <li className={liClass}>Import card data from spreadsheets you select</li>
        <li className={liClass}>Improve the application based on aggregate usage patterns</li>
        <li className={liClass}>Diagnose technical issues via server logs</li>
      </ul>

      {/* 4 */}
      <h2 className={h2Class}>4. Analytics and Opting Out</h2>
      <p className={pClass}>
        We use analytics to understand aggregate usage patterns &mdash; for example, which
        features are used most and where users encounter issues. Analytics data is
        collected in a way that does not personally identify you.
      </p>
      <p className={pClass}>
        <strong>You may opt out of analytics tracking</strong> at any time via the
        Settings page in the application. When you opt out, no analytics data will be
        collected from your browser. You can also use browser extensions such as ad
        blockers or privacy tools to block analytics scripts.
      </p>

      {/* 5 */}
      <h2 className={h2Class}>5. Data Storage and Security</h2>
      <ul className="list-disc pl-6 mb-4">
        <li className={liClass}>
          <strong>Card data</strong> is stored in your browser&rsquo;s localStorage. It never
          leaves your device unless you explicitly use the import/export features.
        </li>
        <li className={liClass}>
          <strong>Authentication tokens</strong> are stored as secure, HTTP-only cookies
          or in-memory and are not accessible to JavaScript.
        </li>
        <li className={liClass}>We use HTTPS for all data transmission.</li>
        <li className={liClass}>
          We do not maintain a database of your card or financial data on our servers.
        </li>
      </ul>

      {/* 6 */}
      <h2 className={h2Class}>6. Data Sharing</h2>
      <p className={pClass}>
        We do not sell, rent, or trade your personal information. We may share information
        only in the following circumstances:
      </p>
      <ul className="list-disc pl-6 mb-4">
        <li className={liClass}>
          <strong>Service providers:</strong> Vercel (hosting), Google (authentication,
          Sheets API), and Anthropic (LLM-based data extraction during import). These
          providers receive only the minimum data necessary to perform their function.
        </li>
        <li className={liClass}>
          <strong>Legal requirements:</strong> If required by law, subpoena, or court order.
        </li>
        <li className={liClass}>
          <strong>Safety:</strong> To protect the rights, safety, or property of our
          users or the public.
        </li>
      </ul>

      {/* 7 */}
      <h2 className={h2Class}>7. Data Retention</h2>
      <ul className="list-disc pl-6 mb-4">
        <li className={liClass}>
          <strong>localStorage data:</strong> Persists until you clear it or uninstall
          the application. We have no access to it.
        </li>
        <li className={liClass}>
          <strong>Authentication sessions:</strong> Expire based on token lifetime
          (typically hours to days).
        </li>
        <li className={liClass}>
          <strong>Server logs:</strong> Retained per our hosting provider&rsquo;s policies
          (typically 30 days).
        </li>
        <li className={liClass}>
          <strong>Analytics data:</strong> Retained in aggregate form. No personally
          identifiable information is stored.
        </li>
      </ul>

      {/* 8 */}
      <h2 className={h2Class}>8. Your Rights</h2>
      <p className={pClass}>Depending on your jurisdiction, you may have the right to:</p>
      <ul className="list-disc pl-6 mb-4">
        <li className={liClass}>Access the personal information we hold about you</li>
        <li className={liClass}>Request correction or deletion of your personal information</li>
        <li className={liClass}>Opt out of analytics tracking (see Section 4)</li>
        <li className={liClass}>Withdraw consent for data processing</li>
        <li className={liClass}>Lodge a complaint with a data protection authority</li>
      </ul>
      <p className={pClass}>
        Since your card data is stored locally in your browser, you have full control
        over it at all times. You can delete it by clearing your browser&rsquo;s localStorage
        for this site.
      </p>
      <p className={pClass}>
        To exercise any other rights, contact us at{" "}
        <a
          href="mailto:privacy@fenrirledger.com"
          className="text-gold underline hover:brightness-110 transition-colors"
        >
          privacy@fenrirledger.com
        </a>
        .
      </p>

      {/* 9 */}
      <h2 className={h2Class}>9. Children&rsquo;s Privacy</h2>
      <p className={pClass}>
        Fenrir Ledger is not directed at children under the age of 13 (or 16 in the
        European Economic Area). We do not knowingly collect personal information from
        children. If you believe a child has provided us with personal information,
        please contact us and we will delete it.
      </p>

      {/* 10 */}
      <h2 className={h2Class}>10. Changes to This Policy</h2>
      <p className={pClass}>
        We may update this Privacy Policy from time to time. When we make changes, we
        will update the &ldquo;Last Updated&rdquo; date above. We encourage you to review this
        policy periodically. Continued use of the service after changes constitutes
        acceptance of the updated policy.
      </p>

      {/* 11 */}
      <h2 className={h2Class}>11. Contact</h2>
      <p className={pClass}>
        If you have questions about this Privacy Policy, please contact us at{" "}
        <a
          href="mailto:privacy@fenrirledger.com"
          className="text-gold underline hover:brightness-110 transition-colors"
        >
          privacy@fenrirledger.com
        </a>
        .
      </p>

      {/* Attribution */}
      <div className="mt-12 pt-6 border-t border-border text-sm text-muted-foreground">
        <p>
          This Privacy Policy is adapted from{" "}
          <a
            href="https://github.com/Automattic/legalmattic"
            className="text-gold underline hover:brightness-110 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Automattic&rsquo;s source-available legal documents
          </a>
          , available under the{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            className="text-gold underline hover:brightness-110 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Creative Commons Attribution-ShareAlike 4.0
          </a>{" "}
          license. This adapted version is shared under the same license.
        </p>
      </div>
    </article>
  );
}
