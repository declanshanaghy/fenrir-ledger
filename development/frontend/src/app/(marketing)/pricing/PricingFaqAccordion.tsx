"use client";

/**
 * PricingFaqAccordion — inline FAQ accordion for the Pricing page.
 *
 * Uses native <details>/<summary> for accessibility and no-JS compatibility.
 * Matches the FaqAccordion pattern from /faq page.
 * All items collapsed by default.
 */

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-card-numbers",
    question: "Does Fenrir collect my credit card numbers?",
    answer:
      "No. Fenrir Ledger never collects, stores, or transmits credit card numbers, CVVs, PINs, passwords, Social Security numbers, or bank account details. Fenrir is a card metadata tracker. We track the information you'd write on a sticky note about your card — the name, issuer, annual fee, and bonus deadline. Not the payment credentials. This applies to manual entry, Smart Import, and all other features. Card number fields simply do not exist in our data model.",
  },
  {
    id: "faq-smart-import-safety",
    question: "Is my data safe during Smart Import?",
    answer:
      "Yes. Smart Import reads your spreadsheet to extract card names, issuers, annual fees, and bonus details. It does not read, copy, or store credit card numbers, CVVs, or passwords — even if those fields appear in your spreadsheet. Our field extraction model is trained on card metadata only. Sensitive payment fields are excluded from the data model.",
  },
  {
    id: "thrall-free-forever",
    question: "Is Thrall actually free forever?",
    answer:
      "Yes. The Thrall tier has no time limit, no trial expiry, and no credit card required. Every core tracking feature — annual fees, sign-up bonuses, velocity management, The Howl — is free. We don't reduce functionality over time to push upgrades.",
  },
  {
    id: "thrall-vs-karl",
    question: "What's the difference between Thrall and Karl in practice?",
    answer:
      "Thrall covers everything you need to track cards on a single device. Karl adds the features that matter when you're serious: your data syncs everywhere you're signed in, you can manage cards for multiple people in your household, and you can import from a spreadsheet or export at any time. If you only track your own cards on one device, Thrall may be all you need.",
  },
  {
    id: "billing",
    question: "How does billing work?",
    answer:
      "Karl subscriptions are billed monthly via Stripe. You can cancel anytime from your account settings — your subscription stays active until the end of the current billing period. We don't offer annual billing at this time.",
  },
  {
    id: "cancel-data",
    question: "What happens to my data if I cancel Karl?",
    answer:
      "Your card data stays intact. If you were using Cloud Sync, your cards remain in the cloud and continue to be accessible — but new changes will only sync after re-subscribing. Whole-Household cards are preserved but you'll only be able to view your primary household until you re-subscribe. We never delete your data when you downgrade.",
  },
  {
    id: "why-not-free",
    question: "Why $3.99 and not free with ads?",
    answer:
      "Fenrir Ledger tracks sensitive financial data — card names, fee amounts, application history. Ads mean ad networks. Ad networks mean your data leaves this site. That's not a trade we're willing to make. $3.99/month keeps Fenrir independent and your data private.",
  },
  {
    id: "smart-import-storage",
    question: "Does Smart Import store my spreadsheet data?",
    answer:
      "Smart Import sends your spreadsheet to an AI model to extract card data. The spreadsheet content is processed in memory and not stored after extraction. Only the extracted card records — name, dates, amounts — are saved to your ledger.",
  },
  {
    id: "refunds",
    question: "Do you offer refunds?",
    answer:
      "If something is wrong, contact us at support@fenrirledger.com within 7 days of a charge and we'll make it right. We don't have a formal refund policy because we haven't needed one.",
  },
];

export function PricingFaqAccordion() {
  return (
    <div className="flex flex-col max-w-[760px] mx-auto">
      {FAQ_ITEMS.map((item) => (
        <details
          key={item.id}
          id={item.id}
          className="group border-b border-border"
        >
          <summary
            className={[
              "flex cursor-pointer list-none items-start justify-between",
              "gap-4 py-6",
              "font-body text-base font-semibold text-foreground",
              "hover:text-primary transition-colors",
              "[&::-webkit-details-marker]:hidden",
            ].join(" ")}
          >
            <span>{item.question}</span>
            {/* Expand icon — rotates when open */}
            <span
              aria-hidden="true"
              className={[
                "shrink-0 font-light text-xl leading-none text-muted-foreground",
                "transition-transform duration-200 group-open:rotate-45",
                "mt-0.5",
              ].join(" ")}
            >
              +
            </span>
          </summary>
          <div className="pb-6 font-body text-sm text-muted-foreground leading-[1.8]">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
