/**
 * Terms of Service page — /terms
 *
 * Migrated from public/static/terms.html into a Next.js server component.
 * Uses the (marketing) layout (nav + footer) via MarketingLayout.
 *
 * Static export: force-static so this page is pre-rendered at build time.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of Fenrir Ledger.",
};

// ── Shared prose classes ─────────────────────────────────────────────────────

const prose =
  "max-w-3xl mx-auto px-4 pt-10 pb-20 font-body text-foreground leading-relaxed";

const h2Class =
  "font-heading text-xl text-gold mt-10 mb-2 pb-1 border-b border-border";

const pClass = "mb-3 text-foreground/90";

const liClass = "mb-2";

const capsClass = "uppercase tracking-wide text-sm";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TermsPage() {
  return (
    <article className={prose}>
      {/* Back link */}
      <Link
        href="/"
        className="inline-block mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Fenrir Ledger
      </Link>

      <h1 className="font-display text-3xl text-gold mb-1">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last Updated: March 3, 2026</p>

      <p className={pClass}>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Fenrir Ledger
        (the &ldquo;Service&rdquo;). Please read them carefully. By accessing or using the Service,
        you agree to be bound by these Terms. If you do not agree, do not use the Service.
      </p>

      {/* 1 */}
      <h2 className={h2Class}>1. Who We Are</h2>
      <p className={pClass}>
        Fenrir Ledger is a credit card rewards tracking application operated by
        Declan Shanaghy (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). The Service is available at{" "}
        <a
          href="https://fenrirledger.com"
          className="text-gold underline hover:brightness-110 transition-colors"
        >
          fenrirledger.com
        </a>
        .
      </p>

      {/* 2 */}
      <h2 className={h2Class}>2. Your Account</h2>
      <p className={pClass}>
        To use certain features of the Service, you must sign in with a Google account.
        You are responsible for maintaining the security of your account credentials and
        for all activity that occurs under your account.
      </p>
      <p className={pClass}>
        You must be at least 13 years old (or 16 in the European Economic Area) to use
        the Service. By using the Service, you represent that you meet this age requirement.
      </p>

      {/* 3 */}
      <h2 className={h2Class}>3. The Service</h2>
      <p className={pClass}>
        Fenrir Ledger helps you track credit card signup bonuses, annual fees, and reward
        milestones. Key aspects of the Service:
      </p>
      <ul className="list-disc pl-6 mb-4">
        <li className={liClass}>
          <strong>Local-first data:</strong> Your card and financial tracking data is
          stored in your browser&rsquo;s localStorage. We do not store this data on our servers.
        </li>
        <li className={liClass}>
          <strong>Import features:</strong> You may import data from Google Sheets or
          CSV files. Imported data is processed to extract card information and is not
          retained on our servers after processing.
        </li>
      </ul>

      {/* 4 */}
      <h2 className={h2Class}>4. Acceptable Use</h2>
      <p className={pClass}>You agree not to:</p>
      <ul className="list-disc pl-6 mb-4">
        <li className={liClass}>
          Use the Service for any unlawful purpose or in violation of any applicable
          laws or regulations
        </li>
        <li className={liClass}>
          Attempt to interfere with, compromise, or disrupt the Service or its infrastructure
        </li>
        <li className={liClass}>
          Reverse engineer, decompile, or disassemble any part of the Service, except
          as permitted by the source-available license governing the source code
        </li>
        <li className={liClass}>
          Use automated means (bots, scrapers, etc.) to access the Service in a manner
          that imposes an unreasonable load on our infrastructure
        </li>
        <li className={liClass}>
          Impersonate any person or entity, or misrepresent your affiliation with any
          person or entity
        </li>
      </ul>

      {/* 5 */}
      <h2 className={h2Class}>5. Intellectual Property</h2>
      <p className={pClass}>
        The Fenrir Ledger source code is available under the{" "}
        <a
          href="https://www.elastic.co/licensing/elastic-license"
          className="text-gold underline hover:brightness-110 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Elastic License 2.0 (ELv2)
        </a>
        . The Service&rsquo;s visual design, branding, name, and logo are the property of
        Declan Shanaghy and may not be used without permission.
      </p>
      <p className={pClass}>
        Your data remains yours. We claim no ownership over any data you enter into or
        import into the Service.
      </p>

      {/* 6 */}
      <h2 className={h2Class}>6. Third-Party Services</h2>
      <p className={pClass}>
        The Service integrates with third-party services including Google (authentication,
        Sheets API), Anthropic (data extraction during import), and Vercel (hosting). Your
        use of these services is subject to their respective terms and privacy policies. We
        are not responsible for the practices of third-party services.
      </p>

      {/* 7 */}
      <h2 className={h2Class}>7. Disclaimer of Warranties</h2>
      <p className={[pClass, capsClass].join(" ")}>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties
        of any kind, whether express or implied, including but not limited to implied
        warranties of merchantability, fitness for a particular purpose, and non-infringement.
      </p>
      <p className={pClass}>
        We do not warrant that the Service will be uninterrupted, secure, or error-free.
        Fenrir Ledger is a tracking tool &mdash; it does not provide financial advice. You are
        solely responsible for your financial decisions.
      </p>

      {/* 8 */}
      <h2 className={h2Class}>8. Limitation of Liability</h2>
      <p className={[pClass, capsClass].join(" ")}>
        To the maximum extent permitted by applicable law, in no event shall we be liable
        for any indirect, incidental, special, consequential, or punitive damages, or any
        loss of profits or revenue, whether incurred directly or indirectly, or any loss of
        data, use, goodwill, or other intangible losses, resulting from:
      </p>
      <ul className="list-disc pl-6 mb-4">
        <li className={liClass}>Your use or inability to use the Service</li>
        <li className={liClass}>Any unauthorized access to or alteration of your data</li>
        <li className={liClass}>
          Loss of data stored in localStorage (e.g., due to browser clearing, device
          failure, or browser updates)
        </li>
        <li className={liClass}>Any third-party conduct or content on the Service</li>
        <li className={liClass}>Any other matter relating to the Service</li>
      </ul>

      {/* 9 */}
      <h2 className={h2Class}>9. Changes to the Service</h2>
      <p className={pClass}>
        We reserve the right to modify, suspend, or discontinue the Service (or any
        part of it) at any time, with or without notice. We are not liable to you or
        any third party for any modification, suspension, or discontinuation of the Service.
      </p>

      {/* 10 */}
      <h2 className={h2Class}>10. Changes to These Terms</h2>
      <p className={pClass}>
        We may revise these Terms from time to time. When we make changes, we will
        update the &ldquo;Last Updated&rdquo; date above. Your continued use of the Service after
        revised Terms take effect constitutes acceptance of the changes. If you do not
        agree to the revised Terms, please stop using the Service.
      </p>

      {/* 11 */}
      <h2 className={h2Class}>11. Governing Law</h2>
      <p className={pClass}>
        These Terms are governed by and construed in accordance with the laws of the
        State of Colorado, United States, without regard to its conflict of law provisions.
      </p>

      {/* 12 */}
      <h2 className={h2Class}>12. Contact</h2>
      <p className={pClass}>
        If you have questions about these Terms, please contact us at{" "}
        <a
          href="mailto:legal@fenrirledger.com"
          className="text-gold underline hover:brightness-110 transition-colors"
        >
          legal@fenrirledger.com
        </a>
        .
      </p>

      {/* Attribution */}
      <div className="mt-12 pt-6 border-t border-border text-sm text-muted-foreground">
        <p>
          These Terms of Service are adapted from{" "}
          <a
            href="https://github.com/Automattic/legalmattic"
            className="text-gold underline hover:brightness-110 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Automattic&rsquo;s source-available legal documents
          </a>{" "}
          and the{" "}
          <a
            href="https://github.com/appdotnet/template-terms-of-service"
            className="text-gold underline hover:brightness-110 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            App.net Terms of Service template
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
