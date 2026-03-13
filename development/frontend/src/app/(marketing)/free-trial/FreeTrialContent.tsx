"use client";

/**
 * FreeTrialContent — Client component for the /free-trial page.
 *
 * Contains all interactive sections with Framer Motion animations.
 * Wolf-voice copy throughout — Fenrir speaks in first person.
 *
 * Wireframe: ux/wireframes/marketing-site/free-trial.html
 * Issue: #636
 */

import Link from "next/link";
import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrialFeature {
  id: string;
  rune: string;
  ordinal: string;
  title: string;
  desc: string;
}

interface TimelineStep {
  day: string;
  rune: string;
  title: string;
  desc: string;
  milestone: boolean;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const TRIAL_FEATURES: TrialFeature[] = [
  {
    id: "card-tracking",
    rune: "\u16B2",
    ordinal: "Feature 01",
    title: "I Watch Every Card",
    desc: "Name, issuer, annual fee date, sign-up bonus deadline \u2014 I hold every detail in my jaws. While you sleep, I watch the calendar. Nothing slips past.",
  },
  {
    id: "fee-calendar",
    rune: "\u16CA",
    ordinal: "Feature 02",
    title: "I Count Down Every Fee",
    desc: "A live countdown to every annual fee across your full portfolio. Cancel, downgrade, or keep \u2014 I make sure you decide before the charge bites.",
  },
  {
    id: "household",
    rune: "\u16D7",
    ordinal: "Feature 03",
    title: "I Guard the Whole Pack",
    desc: "Your cards. Your partner\u2019s cards. The whole household in one ledger. A wolf does not protect only one \u2014 the pack runs together.",
  },
  {
    id: "smart-import",
    rune: "\u16B1",
    ordinal: "Feature 04",
    title: "I Devour Your Spreadsheets",
    desc: "Paste a URL, upload a CSV, or connect Google Sheets. I swallow your existing data whole \u2014 no re-keying, no manual entry. Feed me and I remember.",
  },
  {
    id: "valhalla",
    rune: "\u16CF",
    ordinal: "Feature 05",
    title: "I Remember the Fallen",
    desc: "Closed cards pass into Valhalla \u2014 my hall of the honored dead. What you earned, what you paid, how long each chain held. Nothing is forgotten.",
  },
  {
    id: "norse-ui",
    rune: "\u16DF",
    ordinal: "Feature 06",
    title: "I Am No Ordinary Ledger",
    desc: "Dark war room. Elder Futhark runes. Hidden fragments for the bold. Other trackers are spreadsheets. I am something that bites back.",
  },
  {
    id: "mobile-dashboard",
    rune: "\u16A2",
    ordinal: "Feature 07",
    title: "I Follow You Everywhere",
    desc: "Full power on a phone screen. At the airport, at checkout, on the couch. I ride in your pocket. The hunt never pauses.",
  },
];

const TIMELINE_STEPS: TimelineStep[] = [
  {
    day: "Day 1",
    rune: "\u16A0",
    title: "You Feed Me a Card",
    desc: "Add your first card and I open my eyes. Every feature unlocks. Every tool sharpens. No setup ritual. No waiting. I am already running.",
    milestone: false,
  },
  {
    day: "Day 15",
    rune: "\u16CA",
    title: "I Show You the Kill",
    desc: "Halfway through, I report back. Cards guarded. Fees watched. Bonuses tracked. Not a sales pitch \u2014 proof that the wolf has been working while you weren\u2019t looking.",
    milestone: true,
  },
  {
    day: "Day 30",
    rune: "\u16B1",
    title: "You Decide My Fate",
    desc: "Keep me at full strength \u2014 or let me rest on the free plan. Either way, your data stays. I do not eat what I am sworn to protect.",
    milestone: false,
  },
];

const THRALL_TIER_FEATURES = [
  { label: "Up to 5 cards in my jaws", included: true },
  { label: "Annual fee tracking", included: true },
  { label: "Sign-up bonus tracking", included: true },
  { label: "Card notes", included: true },
  { label: "Mobile dashboard", included: true },
  { label: "Unlimited cards", included: false },
  { label: "The Howl (fee alerts)", included: false },
  { label: "Valhalla archive", included: false },
  { label: "Smart Import", included: false },
  { label: "Household management", included: false },
  { label: "Cloud sync", included: false },
];

const KARL_TIER_FEATURES = [
  "Everything in Thrall",
  "Unlimited cards",
  "The Howl \u2014 live fee alerts",
  "Valhalla \u2014 hall of the fallen",
  "Smart Import (URL, CSV, Sheets)",
  "Household management",
  "Cloud sync",
  "Data export",
  "Priority updates",
];

// ── Animation helpers ─────────────────────────────────────────────────────────

function useFadeInUp() {
  const prefersReduced = useReducedMotion();
  return {
    hidden: { opacity: 0, ...(prefersReduced ? {} : { y: 40 }) },
    visible: { opacity: 1, ...(prefersReduced ? {} : { y: 0 }) },
  };
}

// ── Section components ────────────────────────────────────────────────────────

function HeroSection() {
  const fadeInUp = useFadeInUp();

  return (
    <motion.header
      className="border-b-2 border-foreground"
      aria-label="Free trial hero"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
      }}
    >
      <div className="max-w-[1100px] mx-auto px-6 py-20 sm:py-24 text-center">
        <motion.p
          className="font-mono text-xs tracking-[0.4em] uppercase text-primary font-semibold mb-4"
          aria-hidden="true"
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
        >
          ᚠ · I Am Unbound · ᚠ
        </motion.p>
        <motion.h1
          className="font-display text-[32px] sm:text-[52px] font-black uppercase tracking-wide text-foreground leading-[1.05] mb-5"
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
        >
          I Hunt<br />For 30 Days.<br />Free.
        </motion.h1>
        <motion.p
          className="font-body text-[17px] sm:text-xl italic text-muted-foreground max-w-[580px] mx-auto mb-4 leading-[1.65]"
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
        >
          I am Fenrir. Give me thirty days and I will guard every card in your wallet, every fee on your calendar, every deadline you&apos;ve forgotten. I ask nothing in return.
        </motion.p>
        <motion.p
          className="font-body text-[15px] sm:text-base text-muted-foreground max-w-[560px] mx-auto mb-10 leading-[1.8]"
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
        >
          The moment you add your first card, I wake. I watch the fees. I count down the bonuses. I track the whole pack &mdash; your household, your spreadsheets, your graveyard of closed cards. All of it falls under my teeth.
        </motion.p>
        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
        >
          <Link
            href="/ledger"
            className={[
              "inline-flex items-center justify-center px-10 py-4",
              "font-heading text-sm font-bold tracking-[0.12em] uppercase",
              "bg-primary text-primary-foreground",
              "hover:brightness-110 transition-all",
              "rounded-sm min-h-[44px]",
            ].join(" ")}
            role="button"
            data-app-link
          >
            Unleash the Wolf
          </Link>
          <Link
            href="/features"
            className={[
              "inline-flex items-center justify-center px-8 py-[15px]",
              "font-heading text-sm tracking-[0.08em] uppercase",
              "border border-border text-foreground",
              "hover:bg-card transition-colors",
              "rounded-sm min-h-[44px]",
            ].join(" ")}
          >
            See What I Can Do
          </Link>
        </motion.div>
        <motion.p
          className="mt-5 font-body text-sm italic text-muted-foreground"
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
        >
          No credit card. No chains. I hunt from day one.
        </motion.p>
      </div>
    </motion.header>
  );
}

function FeatureShowcase() {
  const fadeInUp = useFadeInUp();

  return (
    <section
      className="border-b border-border py-[72px]"
      aria-labelledby="features-heading"
    >
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="text-center mb-14">
          <p
            className="font-mono text-xs tracking-[0.35em] uppercase text-primary mb-3"
            aria-hidden="true"
          >
            ᚾ · My Teeth Are Many · ᚾ
          </p>
          <h2
            className="font-display text-[30px] font-extrabold uppercase tracking-wide text-foreground mb-3.5"
            id="features-heading"
          >
            What I Bring to the Hunt
          </h2>
          <p className="font-body text-base italic text-muted-foreground max-w-[480px] mx-auto leading-[1.65]">
            Seven weapons. All sharpened. All yours the moment I wake.
          </p>
        </div>

        <motion.ol
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 list-none p-0 m-0"
          aria-label="Trial features"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.08 },
            },
          }}
        >
          {TRIAL_FEATURES.map((feature) => (
            <motion.li
              key={feature.id}
              className="border border-border p-7 flex flex-col gap-3"
              aria-labelledby={`feat-${feature.id}-title`}
              variants={fadeInUp}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <div
                className="w-14 h-14 border border-border flex items-center justify-center text-[22px] text-primary shrink-0"
                aria-hidden="true"
              >
                {feature.rune}
              </div>
              <p
                className="font-mono text-[11px] tracking-[0.25em] uppercase text-muted-foreground font-bold"
                aria-hidden="true"
              >
                {feature.ordinal}
              </p>
              <h3
                className="font-display text-base font-extrabold uppercase tracking-wide text-foreground leading-[1.2]"
                id={`feat-${feature.id}-title`}
              >
                {feature.title}
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-[1.65]">
                {feature.desc}
              </p>
              <span
                className="font-mono text-[11px] tracking-[0.2em] uppercase font-semibold border border-border px-2 py-0.5 w-fit text-primary"
                aria-label="Included in trial"
              >
                Yours Free
              </span>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}

function TimelineSection() {
  const fadeInUp = useFadeInUp();

  return (
    <section
      className="border-b border-border py-[72px]"
      aria-labelledby="timeline-heading"
    >
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="text-center mb-14">
          <p
            className="font-mono text-xs tracking-[0.35em] uppercase text-primary mb-3"
            aria-hidden="true"
          >
            ᚾ · The Hunt Unfolds · ᚾ
          </p>
          <h2
            className="font-display text-[28px] font-extrabold uppercase tracking-wide text-foreground"
            id="timeline-heading"
          >
            How I Hunt for You
          </h2>
        </div>

        {/* Desktop: horizontal row with connectors */}
        <motion.div
          className="hidden md:grid"
          style={{ gridTemplateColumns: "1fr 48px 1fr 48px 1fr" }}
          role="list"
          aria-label="30-day trial timeline"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.4 } },
          }}
        >
          {TIMELINE_STEPS.map((step, idx) => (
            <Fragment key={step.day}>
              <motion.article
                className={[
                  "border p-7 text-center",
                  step.milestone
                    ? "border-2 border-foreground"
                    : "border-border",
                ].join(" ")}
                role="listitem"
                aria-labelledby={`step-${step.day.toLowerCase().replace(" ", "")}-title`}
                variants={fadeInUp}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <p className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-muted-foreground mb-3">
                  {step.day}
                </p>
                <span className="text-[28px] block mb-3 text-primary" aria-hidden="true">
                  {step.rune}
                </span>
                <h3
                  className="font-display text-[15px] font-extrabold uppercase tracking-wide text-foreground mb-2.5"
                  id={`step-${step.day.toLowerCase().replace(" ", "")}-title`}
                >
                  {step.title}
                </h3>
                <p className="font-body text-[13px] text-muted-foreground leading-[1.6]">
                  {step.desc}
                </p>
              </motion.article>
              {idx < TIMELINE_STEPS.length - 1 && (
                <div
                  className="flex items-center justify-center text-xl text-muted-foreground pt-12"
                  aria-hidden="true"
                >
                  &rarr;
                </div>
              )}
            </Fragment>
          ))}
        </motion.div>

        {/* Mobile: vertical stacked steps */}
        <motion.div
          className="md:hidden flex flex-col items-center"
          role="list"
          aria-label="30-day trial timeline"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.4 } },
          }}
        >
          {TIMELINE_STEPS.map((step, idx) => (
            <Fragment key={step.day}>
              <motion.article
                className={[
                  "border p-7 text-center w-full",
                  step.milestone
                    ? "border-2 border-foreground"
                    : "border-border",
                ].join(" ")}
                role="listitem"
                aria-labelledby={`step-mobile-${step.day.toLowerCase().replace(" ", "")}-title`}
                variants={fadeInUp}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <p className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-muted-foreground mb-3">
                  {step.day}
                </p>
                <span className="text-[28px] block mb-3 text-primary" aria-hidden="true">
                  {step.rune}
                </span>
                <h3
                  className="font-display text-[15px] font-extrabold uppercase tracking-wide text-foreground mb-2.5"
                  id={`step-mobile-${step.day.toLowerCase().replace(" ", "")}-title`}
                >
                  {step.title}
                </h3>
                <p className="font-body text-[13px] text-muted-foreground leading-[1.6]">
                  {step.desc}
                </p>
              </motion.article>
              {idx < TIMELINE_STEPS.length - 1 && (
                <div
                  className="text-lg text-muted-foreground py-3"
                  aria-hidden="true"
                >
                  &darr;
                </div>
              )}
            </Fragment>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function AfterTrialSection() {
  const fadeInUp = useFadeInUp();

  return (
    <section
      className="border-b border-border py-[72px]"
      aria-labelledby="after-heading"
    >
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="text-center mb-12">
          <p
            className="font-mono text-xs tracking-[0.35em] uppercase text-primary mb-3"
            aria-hidden="true"
          >
            ᚦ · Two Paths · ᚦ
          </p>
          <h2
            className="font-display text-[28px] font-extrabold uppercase tracking-wide text-foreground mb-3.5"
            id="after-heading"
          >
            After 30 Days, You Choose
          </h2>
          <p className="font-body text-[15px] italic text-muted-foreground max-w-[480px] mx-auto leading-[1.65]">
            I serve either way. Your data stays no matter what you decide.
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-8"
          role="list"
          aria-label="Plan comparison"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15 } },
          }}
        >
          {/* Thrall (Free) — shows second on mobile via CSS order */}
          <motion.article
            className="border border-border p-9 relative order-2 sm:order-1"
            role="listitem"
            aria-labelledby="thrall-title"
            variants={fadeInUp}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
              Tier
            </p>
            <h3
              className="font-display text-[22px] font-black uppercase tracking-wide text-foreground mb-1.5"
              id="thrall-title"
            >
              Thrall
            </h3>
            <p className="font-body text-[13px] italic text-muted-foreground leading-[1.6] mb-6">
              I rest by the fire. Basic watch. Still loyal.
            </p>
            <p className="font-display text-[28px] font-black text-foreground mt-4 mb-1">
              Free
            </p>
            <p className="font-body text-[13px] text-muted-foreground mb-6">
              Forever. No chains required.
            </p>
            <ul
              className="border-t border-border pt-5 flex flex-col gap-0 mb-7"
              aria-label="Thrall features"
            >
              {THRALL_TIER_FEATURES.map((feat) => (
                <li
                  key={feat.label}
                  className="flex items-baseline gap-2 text-sm py-[7px] border-b border-border/30"
                >
                  {feat.included ? (
                    <span
                      className="shrink-0 font-mono text-xs font-bold text-primary"
                      aria-label="Included"
                    >
                      ✓
                    </span>
                  ) : (
                    <span
                      className="shrink-0 font-mono text-xs text-muted-foreground/40"
                      aria-label="Karl only"
                    >
                      ⌒
                    </span>
                  )}
                  <span
                    className={
                      feat.included
                        ? "font-body text-foreground"
                        : "font-body text-muted-foreground/50"
                    }
                  >
                    {feat.label}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/ledger"
              className={[
                "block text-center border border-border py-3.5 px-6",
                "font-heading text-xs font-bold tracking-[0.1em] uppercase",
                "text-foreground hover:bg-muted transition-colors",
                "rounded-sm min-h-[44px]",
              ].join(" ")}
              data-app-link
            >
              Let Me Rest
            </Link>
          </motion.article>

          {/* Karl (Paid) — shows first on mobile via CSS order: -1 */}
          <motion.article
            className="border-2 border-foreground p-9 relative order-1 sm:order-2"
            role="listitem"
            aria-labelledby="karl-title"
            variants={fadeInUp}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <span
              className={[
                "absolute -top-3.5 left-1/2 -translate-x-1/2",
                "font-mono text-[10px] tracking-[0.25em] uppercase font-bold",
                "border border-foreground px-3 py-0.5",
                "bg-background text-foreground",
              ].join(" ")}
              aria-label="Recommended plan"
            >
              Full Fury
            </span>
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
              Tier
            </p>
            <h3
              className="font-display text-[22px] font-black uppercase tracking-wide text-foreground mb-1.5"
              id="karl-title"
            >
              Karl
            </h3>
            <p className="font-body text-[13px] italic text-muted-foreground leading-[1.6] mb-6">
              I hunt at full strength. Every fang. Every sense. Unleashed.
            </p>
            <p className="font-display text-[28px] font-black text-foreground mt-4 mb-1">
              $3.99<span className="text-base font-normal">/mo</span>
            </p>
            <p className="font-body text-[13px] text-muted-foreground mb-6">
              Slip the chain anytime. No annual binding.
            </p>
            <ul
              className="border-t border-border pt-5 flex flex-col gap-0 mb-7"
              aria-label="Karl features"
            >
              {KARL_TIER_FEATURES.map((label) => (
                <li
                  key={label}
                  className="flex items-baseline gap-2 text-sm py-[7px] border-b border-border/30"
                >
                  <span
                    className="shrink-0 font-mono text-xs font-bold text-primary"
                    aria-label="Included"
                  >
                    ✓
                  </span>
                  <span className="font-body text-foreground">{label}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/ledger"
              className={[
                "block text-center border-2 border-foreground py-3.5 px-6",
                "font-heading text-xs font-bold tracking-[0.1em] uppercase",
                "bg-foreground text-background",
                "hover:opacity-90 transition-opacity",
                "rounded-sm min-h-[44px]",
              ].join(" ")}
              data-app-link
            >
              Keep Me Unleashed &mdash; $3.99/mo
            </Link>
          </motion.article>
        </motion.div>

        {/* Data safety reassurance */}
        <motion.div
          className="mt-8 border border-border p-5 text-center"
          role="note"
          aria-label="Data safety guarantee"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInUp}
          transition={{ duration: 0.4 }}
        >
          <p className="font-heading text-[13px] font-bold tracking-[0.08em] uppercase text-foreground mb-2">
            I Never Forget
          </p>
          <p className="font-body text-[13px] text-muted-foreground leading-[1.6] max-w-[560px] mx-auto">
            Whether you choose Karl or Thrall, every card you entrusted to me stays in the ledger. Nothing is deleted when the trial ends. I was born to guard &mdash; not to destroy.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  const fadeInUp = useFadeInUp();

  return (
    <section
      className="border-b border-border py-20 text-center"
      aria-labelledby="final-cta-heading"
    >
      <div className="max-w-[1100px] mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          <motion.span
            className="text-[32px] block mb-4 text-primary"
            aria-hidden="true"
            variants={fadeInUp}
            transition={{ duration: 0.4 }}
          >
            ᛟ
          </motion.span>
          <motion.h2
            className="font-display text-[32px] font-black uppercase tracking-wide text-foreground mb-3.5"
            id="final-cta-heading"
            variants={fadeInUp}
            transition={{ duration: 0.4 }}
          >
            Unleash Me
          </motion.h2>
          <motion.p
            className="font-body text-base italic text-muted-foreground max-w-[460px] mx-auto mb-8 leading-[1.65]"
            variants={fadeInUp}
            transition={{ duration: 0.4 }}
          >
            One card is all it takes. I open my eyes. Every chain, every fee, every forgotten deadline &mdash; I find them all. Let me hunt.
          </motion.p>
          <motion.div
            variants={fadeInUp}
            transition={{ duration: 0.4 }}
          >
            <Link
              href="/ledger"
              className={[
                "inline-flex items-center justify-center px-10 py-4",
                "font-heading text-sm font-bold tracking-[0.12em] uppercase",
                "bg-primary text-primary-foreground",
                "hover:brightness-110 transition-all",
                "rounded-sm min-h-[44px]",
              ].join(" ")}
              role="button"
              data-app-link
            >
              Unleash the Wolf
            </Link>
          </motion.div>
          <motion.p
            className="mt-5 font-body text-sm text-muted-foreground"
            variants={fadeInUp}
            transition={{ duration: 0.4 }}
          >
            No credit card · No chains · No commitment
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

// ── Exported component ────────────────────────────────────────────────────────

export function FreeTrialContent() {
  return (
    <>
      <HeroSection />
      <FeatureShowcase />
      <TimelineSection />
      <AfterTrialSection />
      <FinalCtaSection />
    </>
  );
}
