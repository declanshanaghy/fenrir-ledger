"use client";

/**
 * FaqAccordion — client component for collapsible FAQ questions.
 *
 * Uses native <details>/<summary> for maximum accessibility and no-JS
 * compatibility. Progressively enhances with CSS transitions.
 *
 * Each question is individually openable/closeable.
 * The category heading is always visible.
 */

import faqData from "@/data/faq.json";

// ── Types ────────────────────────────────────────────────────────────────────

interface FaqQuestion {
  id: string;
  question: string;
  answer: string;
}

interface FaqCategory {
  id: string;
  category: string;
  questions: FaqQuestion[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function FaqAccordion() {
  const categories = faqData as FaqCategory[];

  return (
    <div className="space-y-10">
      {categories.map((cat) => (
        <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
          {/* Category heading */}
          <h2
            id={`cat-${cat.id}`}
            className="font-heading text-lg text-gold mb-4 pb-2 border-b border-border"
          >
            {cat.category}
          </h2>

          {/* Questions */}
          <div className="space-y-2">
            {cat.questions.map((q) => (
              <details
                key={q.id}
                className="group rounded-sm border border-border bg-card
                           open:border-gold/40 transition-colors"
              >
                <summary
                  className="flex cursor-pointer list-none items-center
                             justify-between gap-4 px-5 py-4
                             font-body text-foreground font-semibold
                             hover:text-gold transition-colors
                             [&::-webkit-details-marker]:hidden"
                  aria-expanded="false"
                >
                  <span>{q.question}</span>

                  {/* Chevron — rotates when open */}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-muted-foreground transition-transform
                               duration-200 group-open:rotate-180"
                  >
                    ▾
                  </span>
                </summary>

                {/* Answer */}
                <div className="px-5 pb-5 pt-1 font-body text-foreground/80 leading-relaxed text-sm">
                  {q.answer}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
