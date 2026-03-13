"use client";

/**
 * About Page — /about
 *
 * The showpiece. Origin story, team showcase, agent chain visualization,
 * and the Norse mythology that drives Fenrir Ledger.
 *
 * Sections:
 *   1. Origin Story Hero — mythic opening, Gleipnir metaphor
 *   2. Why the Wolf — two-column founding myth detail
 *   3. The Pack — 5 agent profile cards + future placeholder
 *   4. The Forge — agent chain visualization
 *
 * Uses Framer Motion for scroll-triggered stagger animations.
 * Agent portraits load from /images/team/{slug}-{dark|light}.png when
 * available; falls back to runic symbol placeholder.
 *
 * Wireframe: ux/wireframes/marketing-site/about.html
 */

export const dynamic = "force-static";

import { useRef, useState, useCallback } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Rune characters (Elder Futhark). */
const RUNE = {
  fehu: "ᚠ",
  ehwaz: "ᛖ",
  naudiz: "ᚾ",
  raidho: "ᚱ",
  isa: "ᛁ",
  laguz: "ᛚ",
  tiwaz: "ᛏ",
  hagalaz: "ᚺ",
} as const;

/** FENRIR in Elder Futhark runes. */
const FENRIR_RUNES = `${RUNE.fehu} ${RUNE.ehwaz} ${RUNE.naudiz} ${RUNE.raidho} ${RUNE.isa} ${RUNE.raidho}`;

/** Unique hover effect types for agent cards. */
type HoverEffect = "glow" | "shimmer" | "fire" | "glitch";

/** Agent profile data. */
interface AgentProfile {
  readonly name: string;
  readonly slug: string;
  readonly role: string;
  readonly rune: string;
  readonly bio: string;
  readonly hoverEffect: HoverEffect;
}

const AGENTS: readonly AgentProfile[] = [
  {
    name: "Freya",
    slug: "freya",
    role: "Product Owner",
    rune: RUNE.fehu,
    bio: "Guardian of the product vision. She shapes what Fenrir becomes, channeling user needs into features. Powers the import pipeline that reads your credit card data and transforms chaos into clarity.",
    hoverEffect: "glow",
  },
  {
    name: "Luna",
    slug: "luna",
    role: "UX Designer",
    rune: RUNE.laguz,
    bio: "Architect of every interface, every interaction. She ensures the ledger feels mythic yet usable, that every click has purpose, every view tells a story. The wolf\u2019s eyes see through her designs.",
    hoverEffect: "shimmer",
  },
  {
    name: "FiremanDecko",
    slug: "fireman-decko",
    role: "Principal Engineer",
    rune: RUNE.tiwaz,
    bio: "The forge-master who transforms design into reality. Every component, every API, every line of code flows from his keyboard. He builds with the precision of dwarven smiths and the power of Mjolnir.",
    hoverEffect: "fire",
  },
  {
    name: "Loki",
    slug: "loki",
    role: "QA Tester",
    rune: RUNE.laguz,
    bio: "Son of the wolf, breaker of things. He tests with chaos and cunning, finding bugs before users do. Every edge case is his playground, every error his trophy. If it can break, Loki will break it first.",
    hoverEffect: "glitch",
  },
  {
    name: "Heimdall",
    slug: "heimdall",
    role: "Security Guardian",
    rune: RUNE.hagalaz,
    bio: "Watcher of the Rainbow Bridge, guardian of your data. He sees all threats, blocks all intrusions. Your financial data is his sacred charge. Not even Loki\u2019s tricks can bypass his vigilance.",
    hoverEffect: "glow",
  },
] as const;

/** Agent chain nodes for the forge visualization. */
const CHAIN_NODES = [
  { rune: RUNE.fehu, label: "Freya Defines", desc: "Requirements & user stories" },
  { rune: RUNE.laguz, label: "Luna Designs", desc: "Wireframes & interactions" },
  { rune: RUNE.tiwaz, label: "FiremanDecko Builds", desc: "Code & implementation" },
  { rune: RUNE.laguz, label: "Loki Validates", desc: "Testing & QA" },
] as const;

// ── Animation variants ────────────────────────────────────────────────────────

const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const STAGGER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const CARD_VARIANT: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

const CHAIN_NODE_VARIANT: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

// ── Shared components ─────────────────────────────────────────────────────────

/** Section wrapper with scroll-triggered stagger animation. */
function AnimatedSection({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={STAGGER}
      aria-label={label}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/** Section label + heading combo used across all sections. */
function SectionHeading({
  label,
  title,
  subtitle,
}: {
  label: string;
  title: string;
  subtitle?: string;
}): React.ReactElement {
  return (
    <div className="text-center mb-10">
      <motion.p
        variants={FADE_UP}
        className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-3"
      >
        {label}
      </motion.p>
      <motion.h2
        variants={FADE_UP}
        className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground mb-4"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          variants={FADE_UP}
          className="font-body text-base text-muted-foreground max-w-lg mx-auto leading-relaxed"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

// ── Agent portrait with image fallback ────────────────────────────────────────

function AgentPortrait({
  agent,
}: {
  agent: AgentProfile;
}): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const variant = resolvedTheme === "dark" ? "dark" : "light";
  const [imgError, setImgError] = useState(false);

  const handleError = useCallback((): void => {
    setImgError(true);
  }, []);

  // Fallback: runic symbol placeholder
  if (imgError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <span className="text-6xl opacity-40 font-heading text-primary animate-pulse">
          {agent.rune}
        </span>
        <span className="text-[11px] text-muted-foreground/60 italic font-body">
          Portrait coming soon
        </span>
      </div>
    );
  }

  return (
    <Image
      src={`/images/team/${agent.slug}-${variant}.png`}
      alt={`${agent.name} \u2014 ${agent.role}`}
      width={512}
      height={512}
      className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
      onError={handleError}
      unoptimized
    />
  );
}

/** Hover overlay effect matched to agent personality. */
function HoverOverlay({ effect }: { effect: HoverEffect }): React.ReactElement {
  const cls: Record<HoverEffect, string> = {
    glow: "about-hover-glow",
    shimmer: "about-hover-shimmer",
    fire: "about-hover-fire",
    glitch: "about-hover-glitch",
  };

  return (
    <div
      className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${cls[effect]}`}
      aria-hidden="true"
    />
  );
}

// ── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentProfile }): React.ReactElement {
  return (
    <motion.div
      variants={CARD_VARIANT}
      whileHover={{ y: -8, scale: 1.02, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      className="group relative flex flex-col border border-border overflow-hidden
                 bg-card transition-[box-shadow,border-color] duration-300
                 hover:shadow-gold-md hover:border-primary/40"
    >
      {/* Portrait */}
      <div className="relative w-full aspect-square border-b border-border overflow-hidden bg-muted/50">
        <AgentPortrait agent={agent} />
        <HoverOverlay effect={agent.hoverEffect} />
        <span
          className="absolute top-3 right-3 text-xl opacity-20 group-hover:opacity-60
                     transition-opacity duration-300 font-heading text-primary"
          aria-hidden="true"
        >
          {agent.rune}
        </span>
      </div>

      {/* Info */}
      <div className="p-6 flex flex-col gap-2">
        <h3 className="font-heading text-lg font-semibold text-foreground">
          {agent.name}
        </h3>
        <p className="font-mono text-xs tracking-widest text-primary uppercase">
          {agent.role}
        </p>
        <p className="font-body text-sm text-muted-foreground leading-relaxed mt-1">
          {agent.bio}
        </p>
      </div>
    </motion.div>
  );
}

// ── Section: Origin Hero ──────────────────────────────────────────────────────

function OriginHeroSection(): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={STAGGER}
      aria-label="Origin story"
      className="relative border-b border-border bg-card"
    >
      {/* Faint runic grid background */}
      <div className="absolute inset-0 about-runic-bg opacity-[0.03] pointer-events-none" aria-hidden="true" />

      <div className="max-w-[1100px] mx-auto px-6 py-20 sm:py-32 text-center relative">
        <motion.p
          variants={FADE_UP}
          className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-6"
        >
          {FENRIR_RUNES}
        </motion.p>

        <motion.h1
          variants={FADE_UP}
          className="font-display text-3xl sm:text-5xl lg:text-6xl font-black leading-none tracking-wide text-foreground uppercase mb-6"
        >
          The Wolf Was Not Bound.
          <br />
          <span className="text-primary">You Are.</span>
        </motion.h1>

        <motion.p
          variants={FADE_UP}
          className="font-body text-lg sm:text-xl italic text-muted-foreground mb-12"
        >
          Every annual fee is Gleipnir &mdash; the impossible chain
        </motion.p>

        <motion.div variants={FADE_UP} className="max-w-2xl mx-auto space-y-5">
          <p className="font-body text-base text-muted-foreground leading-relaxed">
            In Norse mythology,{" "}
            <a
              href="https://en.wikipedia.org/wiki/Fenrir"
              target="_blank"
              rel="noopener noreferrer"
              className="myth-link"
            >
              Fenrir
            </a>{" "}
            was the wolf prophesied to devour Odin at{" "}
            <a
              href="https://en.wikipedia.org/wiki/Ragnar%C3%B6k"
              target="_blank"
              rel="noopener noreferrer"
              className="myth-link"
            >
              Ragnarok
            </a>
            . The gods feared him, so they bound him with{" "}
            <a
              href="https://en.wikipedia.org/wiki/Gleipnir"
              target="_blank"
              rel="noopener noreferrer"
              className="myth-link"
            >
              Gleipnir
            </a>{" "}
            &mdash; a chain forged from impossible things: the breath of a fish,
            the beard of a woman, the roots of a mountain.
          </p>
          <p className="font-body text-base text-foreground leading-relaxed font-semibold">
            Credit card companies are your Gleipnir.
          </p>
          <p className="font-body text-base text-muted-foreground leading-relaxed">
            They bind you with things that seem impossible to track: annual fees
            that strike in silence, sign-up bonuses that expire forgotten,
            rewards that vanish unclaimed.
          </p>
          <p className="font-body text-base text-foreground leading-relaxed font-semibold">
            Fenrir Ledger breaks the chain.
          </p>
          <p className="font-body text-base text-muted-foreground leading-relaxed">
            Built by Odin himself to free you from the bonds of modern finance.
            The wolf remembers what you forget. The wolf watches what you miss.
          </p>
        </motion.div>
      </div>
    </motion.section>
  );
}

// ── Section: Why the Wolf ─────────────────────────────────────────────────────

function WhyTheWolfSection(): React.ReactElement {
  return (
    <AnimatedSection label="The founding myth" className="border-b border-border">
      <div className="max-w-[1100px] mx-auto px-6 py-14 sm:py-20">
        <SectionHeading
          label={RUNE.fehu}
          title="Why the Wolf?"
          subtitle=""
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <motion.div variants={FADE_UP} className="space-y-4">
            <h3 className="font-heading text-lg font-semibold text-foreground">
              The Personal Mission
            </h3>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              Odin, the Allfather of this codebase, watched too many warriors
              fall to forgotten fees. Too many friends missing bonuses. Too many
              kin paying for cards they don&apos;t use.
            </p>
            <blockquote className="border-l-2 border-primary pl-4 my-5">
              <p className="font-body text-sm italic text-muted-foreground leading-relaxed">
                &ldquo;I built Fenrir because I was tired of being
                Gleipnir&apos;s victim. Now the wolf hunts for us all.&rdquo;
              </p>
              <cite className="block mt-2 font-mono text-xs not-italic text-primary">
                &mdash; Odin
              </cite>
            </blockquote>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              This isn&apos;t corporate software. This is mythology made
              manifest. Every line of code is a fang. Every notification is a
              howl. Every saved dollar is plunder from the hoard.
            </p>
          </motion.div>

          <motion.div variants={FADE_UP} className="space-y-4">
            <h3 className="font-heading text-lg font-semibold text-foreground">
              The Norse Connection
            </h3>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              We didn&apos;t choose Norse mythology for aesthetics. We chose it
              because it fits. The credit card industry deals in cycles &mdash;
              billing cycles, statement cycles, promo cycles. Norse mythology
              understands cycles:{" "}
              <a
                href="https://en.wikipedia.org/wiki/Ragnar%C3%B6k"
                target="_blank"
                rel="noopener noreferrer"
                className="myth-link"
              >
                Ragnarok
              </a>{" "}
              isn&apos;t the end, it&apos;s the turning of the wheel.
            </p>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              Every card you close breaks a link in Gleipnir. Every fee you
              dodge weakens the binding. Every bonus you claim is tribute taken
              back from those who would bind you.
            </p>
            <blockquote className="border-l-2 border-primary pl-4 my-5">
              <p className="font-body text-sm italic text-muted-foreground leading-relaxed">
                &ldquo;Though it looks like silk ribbon, no chain is
                stronger.&rdquo;
              </p>
              <cite className="block mt-2 font-mono text-xs not-italic text-primary">
                &mdash;{" "}
                <a
                  href="https://en.wikipedia.org/wiki/Prose_Edda"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="myth-link"
                >
                  Prose Edda
                </a>
                , on{" "}
                <a
                  href="https://en.wikipedia.org/wiki/Gleipnir"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="myth-link"
                >
                  Gleipnir
                </a>
              </cite>
            </blockquote>
          </motion.div>
        </div>
      </div>
    </AnimatedSection>
  );
}

// ── Section: The Pack ─────────────────────────────────────────────────────────

function ThePackSection(): React.ReactElement {
  return (
    <AnimatedSection
      label="The agents of Asgard"
      className="border-b border-border bg-card"
    >
      <div className="max-w-[1100px] mx-auto px-6 py-14 sm:py-20">
        <SectionHeading
          label={RUNE.tiwaz}
          title="The Agents of Asgard"
          subtitle="Every member of the pack has their domain, their purpose, their saga."
        />

        <motion.div
          variants={STAGGER}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {AGENTS.map((agent) => (
            <AgentCard key={agent.slug} agent={agent} />
          ))}

          {/* Future agent placeholder */}
          <motion.div
            variants={CARD_VARIANT}
            className="flex flex-col border border-dashed border-border/40 overflow-hidden
                       bg-card/30 opacity-30"
          >
            <div className="w-full aspect-square border-b border-border/30 flex items-center justify-center bg-muted/20">
              <span className="text-6xl opacity-30 font-heading text-muted-foreground">
                ?
              </span>
            </div>
            <div className="p-6 flex flex-col gap-2">
              <h3 className="font-heading text-lg font-semibold text-foreground/50">
                Coming Soon
              </h3>
              <p className="font-mono text-xs tracking-widest text-muted-foreground/40 uppercase">
                The Pack Grows
              </p>
              <p className="font-body text-sm text-muted-foreground/30 leading-relaxed mt-1">
                New agents join when Odin calls. Each brings their skills to
                strengthen Fenrir.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

// ── Section: The Forge ───────────────────────────────────────────────────────

function TheForgeSection(): React.ReactElement {
  return (
    <AnimatedSection label="The Forge" className="border-b border-border">
      <div className="max-w-[1100px] mx-auto px-6 py-14 sm:py-20">
        <SectionHeading
          label={RUNE.hagalaz}
          title="Forged in the Fires of Asgard"
          subtitle="From vision to validation, every feature passes through the forge. Odin orchestrates. The pack delivers."
        />

        {/* Chain visualization */}
        <motion.div
          variants={STAGGER}
          className="flex flex-col sm:flex-row items-stretch justify-between gap-0 sm:gap-0 my-8 max-w-[900px] mx-auto"
        >
          {CHAIN_NODES.map((node, i) => (
            <motion.div
              key={node.label}
              variants={CHAIN_NODE_VARIANT}
              className="relative flex-1 flex flex-col items-center gap-3 p-5
                         border border-border bg-card card-interactive
                         hover:bg-card-hover"
            >
              <div
                className="w-14 h-14 border-2 border-primary/30 flex items-center justify-center
                           text-xl font-heading text-primary"
                aria-hidden="true"
              >
                {node.rune}
              </div>
              <span className="font-heading text-sm font-semibold text-foreground text-center">
                {node.label}
              </span>
              <span className="font-body text-xs text-muted-foreground text-center">
                {node.desc}
              </span>

              {/* Connector arrows */}
              {i < CHAIN_NODES.length - 1 && (
                <>
                  {/* Desktop: right arrow */}
                  <span
                    className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2
                               text-lg text-primary/50 z-10"
                    aria-hidden="true"
                  >
                    {"\u2192"}
                  </span>
                  {/* Mobile: down arrow */}
                  <span
                    className="sm:hidden absolute -bottom-3 left-1/2 -translate-x-1/2
                               text-lg text-primary/50 z-10"
                    aria-hidden="true"
                  >
                    {"\u2193"}
                  </span>
                </>
              )}
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          variants={FADE_UP}
          className="text-center font-body text-sm text-muted-foreground leading-relaxed mt-8 max-w-2xl mx-auto"
        >
          Each member of the pack has autonomy within their domain. They collaborate through
          shared artifacts: design docs, wireframes, code. The result is
          software with the consistency of a singular vision but the expertise
          of specialists.
        </motion.p>

        <motion.p
          variants={FADE_UP}
          className="text-center font-body text-base mt-6"
        >
          <strong className="text-foreground">The forge never cools.</strong>{" "}
          <span className="text-muted-foreground">
            Features shipped at the speed of thought. Bugs slain before
            they draw first blood.
          </span>
        </motion.p>
      </div>
    </AnimatedSection>
  );
}

// ── Section: Final CTA ────────────────────────────────────────────────────────

function FinalCtaSection(): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={STAGGER}
      aria-label="Call to action"
    >
      <div className="max-w-[1100px] mx-auto px-6 py-20 sm:py-28 text-center">
        <motion.h2
          variants={FADE_UP}
          className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-6"
        >
          The wolf waits. The chain weakens.
        </motion.h2>
        <motion.p
          variants={FADE_UP}
          className="font-body text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Every day you delay is another fee that might land, another bonus that
          might expire. Start tracking before the next deadline passes.
        </motion.p>
        <motion.div variants={FADE_UP}>
          <Link
            href="/ledger"
            className={[
              "inline-flex items-center justify-center px-10 py-4",
              "font-heading text-sm font-bold tracking-widest uppercase",
              "bg-primary text-primary-foreground",
              "hover:bg-primary hover:brightness-110 transition-colors",
              "rounded-sm",
            ].join(" ")}
            data-app-link
          >
            Open the Ledger
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AboutPage(): React.ReactElement {
  return (
    <>
      <OriginHeroSection />
      <WhyTheWolfSection />
      <ThePackSection />
      <TheForgeSection />
      <FinalCtaSection />
    </>
  );
}
