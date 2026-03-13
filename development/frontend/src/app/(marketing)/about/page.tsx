"use client";

/**
 * About Page — /about
 *
 * The showpiece. Origin story, team showcase woven into the mythology,
 * agent chain visualization, and the Norse mythology that drives Fenrir Ledger.
 *
 * Sections:
 *   1. Origin Story Hero — mythic opening, Gleipnir metaphor
 *   2. Why the Wolf — two-column founding myth detail
 *   3. The Myth with Agents — dual-realm agent profiles flanking myth narrative
 *   4. The Forge — agent chain visualization
 *   5. Final CTA
 *
 * Issue #633: Agents woven into The Myth section with alternating L/R layout,
 * dual-realm (Ljosalfar/Svartalfar) lore per agent, crossfade portraits on
 * theme toggle, and personality-specific hover overlays.
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
import { DataSafetyBanner } from "@/components/marketing/DataSafetyBanner";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Rune characters (Elder Futhark). */
const RUNE = {
  fehu: "\u16A0",
  ehwaz: "\u16D6",
  naudiz: "\u16BE",
  raidho: "\u16B1",
  isa: "\u16C1",
  laguz: "\u16DA",
  tiwaz: "\u16CF",
  hagalaz: "\u16BA",
} as const;

/** FENRIR in Elder Futhark runes. */
const FENRIR_RUNES = `${RUNE.fehu} ${RUNE.ehwaz} ${RUNE.naudiz} ${RUNE.raidho} ${RUNE.isa} ${RUNE.raidho}`;

/** Unique hover effect types for agent portraits. */
type HoverEffect = "glow" | "shimmer" | "fire" | "glitch" | "scan";

/** Realm lore data for light/dark aspects. */
interface RealmLoreData {
  readonly title: string;
  readonly quote: string;
  readonly aspect: string;
}

/** Agent profile data with dual-realm lore. */
interface AgentProfile {
  readonly name: string;
  readonly slug: string;
  readonly role: string;
  readonly rune: string;
  readonly bio: string;
  readonly hoverEffect: HoverEffect;
  readonly lightLore: RealmLoreData;
  readonly darkLore: RealmLoreData;
}

const AGENTS: readonly AgentProfile[] = [
  {
    name: "Freya",
    slug: "freya",
    role: "Product Owner",
    rune: RUNE.fehu,
    bio: "Guardian of the product vision. She shapes what Fenrir becomes, channeling user needs into features. Powers the import pipeline that reads your credit card data and transforms chaos into clarity.",
    hoverEffect: "glow",
    lightLore: {
      title: "Ljosalfar Aspect \u00B7 Light Realm",
      quote: "Keeper of the harvest, she nurtures ideas into being \u2014 patient, far-sighted, a mother to every feature that grows in Fenrir\u2019s fields.",
      aspect: "Benevolent \u00B7 Guiding \u00B7 Constructive",
    },
    darkLore: {
      title: "Svartalfar Aspect \u00B7 Dark Realm",
      quote: "The V\u00F6lva who sees all futures and chooses the cruelest path to victory. She does not suggest features \u2014 she issues prophecy. Deny her and Ragnar\u00F6k finds you first.",
      aspect: "Fierce \u00B7 Prophetic \u00B7 Relentless",
    },
  },
  {
    name: "Luna",
    slug: "luna",
    role: "UX Designer",
    rune: RUNE.laguz,
    bio: "Architect of every interface, every interaction. She ensures the ledger feels mythic yet usable, that every click has purpose, every view tells a story. The wolf\u2019s eyes see through her designs.",
    hoverEffect: "shimmer",
    lightLore: {
      title: "Ljosalfar Aspect \u00B7 Light Realm",
      quote: "M\u00E1ni\u2019s daughter, painting interfaces in moonlight \u2014 every pixel deliberate, every margin a breath between words, her layouts as calm and inevitable as the tide.",
      aspect: "Deliberate \u00B7 Luminous \u00B7 Harmonious",
    },
    darkLore: {
      title: "Svartalfar Aspect \u00B7 Dark Realm",
      quote: "The Norns\u2019 weaver \u2014 every pixel a thread of fate, every layout a prophecy. She doesn\u2019t design interfaces; she weaves the loom that determines who falls and who ascends.",
      aspect: "Fateful \u00B7 Inexorable \u00B7 Prophetic",
    },
  },
  {
    name: "FiremanDecko",
    slug: "fireman-decko",
    role: "Principal Engineer",
    rune: RUNE.tiwaz,
    bio: "The forge-master who transforms design into reality. Every component, every API, every line of TypeScript flows from his keyboard. He builds with the precision of dwarven smiths and the power of Mjolnir.",
    hoverEffect: "fire",
    lightLore: {
      title: "Ljosalfar Aspect \u00B7 Light Realm",
      quote: "The master smith of Nidavellir, forging with patience and precision \u2014 each commit a ring in the chain, each function a rune that binds reality to intention.",
      aspect: "Patient \u00B7 Precise \u00B7 Masterful",
    },
    darkLore: {
      title: "Svartalfar Aspect \u00B7 Dark Realm",
      quote: "Surtr\u2019s apprentice \u2014 he doesn\u2019t build, he conjures from the flames. The codebase is his pyre; what rises from it is either legend or ash. There is no middle outcome.",
      aspect: "Incendiary \u00B7 Absolute \u00B7 Uncompromising",
    },
  },
  {
    name: "Loki",
    slug: "loki",
    role: "QA Tester",
    rune: RUNE.laguz,
    bio: "Son of the wolf, breaker of things. He tests with chaos and cunning, finding bugs before users do. Every edge case is his playground, every error his trophy. If it can break, Loki will break it first.",
    hoverEffect: "glitch",
    lightLore: {
      title: "Ljosalfar Aspect \u00B7 Light Realm",
      quote: "The trickster who finds flaws before they become wounds \u2014 his mischief is medicine, his pranks preventative, each test a gentle probe that saves the pack from greater harm.",
      aspect: "Curious \u00B7 Preventive \u00B7 Cleverly Protective",
    },
    darkLore: {
      title: "Svartalfar Aspect \u00B7 Dark Realm",
      quote: "Chaos incarnate \u2014 he doesn\u2019t find bugs, he breeds them to hunt their parents. He is the wolf inside the wolf, the test that tears the code apart to prove whether it deserved to live.",
      aspect: "Chaotic \u00B7 Relentless \u00B7 Merciless",
    },
  },
  {
    name: "Heimdall",
    slug: "heimdall",
    role: "Security Guardian",
    rune: RUNE.hagalaz,
    bio: "Watcher of the Rainbow Bridge, guardian of your data. He sees all threats, blocks all intrusions. Your financial data is his sacred charge. Not even Loki\u2019s tricks can bypass his vigilance.",
    hoverEffect: "scan",
    lightLore: {
      title: "Ljosalfar Aspect \u00B7 Light Realm",
      quote: "The watchman who guards all nine realms \u2014 patient as stone at the Bifr\u00F6st\u2019s edge, his eye ever open, his horn Gjallarhorn poised but silent so long as the realms are safe.",
      aspect: "Vigilant \u00B7 Patient \u00B7 Protective",
    },
    darkLore: {
      title: "Svartalfar Aspect \u00B7 Dark Realm",
      quote: "He who hears the grass grow and the wool stretch on sheep across the nine realms \u2014 nothing escapes, nothing is forgiven. He does not warn; he terminates. The audit log is his axe.",
      aspect: "Omniscient \u00B7 Merciless \u00B7 Zero-Tolerance",
    },
  },
] as const;

/** Rune dividers between agent rows. */
const AGENT_DIVIDERS: readonly string[] = [
  `${RUNE.fehu} \u00B7 \u00B7 \u00B7 ${RUNE.laguz}`,
  `${RUNE.laguz} \u00B7 \u00B7 \u00B7 ${RUNE.tiwaz}`,
  `${RUNE.tiwaz} \u00B7 \u00B7 \u00B7 ${RUNE.laguz}`,
  `${RUNE.laguz} \u00B7 \u00B7 \u00B7 ${RUNE.hagalaz}`,
];

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

/** Agent row slides in from left (even-index: portrait on left). */
const ROW_FROM_LEFT: Variants = {
  hidden: { opacity: 0, x: -32 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

/** Agent row slides in from right (odd-index: portrait on right). */
const ROW_FROM_RIGHT: Variants = {
  hidden: { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

/** Stagger children within an agent row. */
const ROW_STAGGER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const CHILD_FADE: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
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

// ── Dual-realm portrait with crossfade ──────────────────────────────────────

/** Portrait with light/dark crossfade on theme toggle. Both images always in DOM. */
function DualRealmPortrait({
  agent,
}: {
  agent: AgentProfile;
}): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [lightError, setLightError] = useState(false);
  const [darkError, setDarkError] = useState(false);

  const handleLightError = useCallback((): void => setLightError(true), []);
  const handleDarkError = useCallback((): void => setDarkError(true), []);

  const bothFailed = lightError && darkError;

  if (bothFailed) {
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
    <>
      {/* Light portrait */}
      <Image
        src={`/images/team/${agent.slug}-light.png`}
        alt={`${agent.name} \u2014 light realm portrait`}
        width={512}
        height={512}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out motion-reduce:transition-none"
        style={{ opacity: isDark ? 0 : 1 }}
        onError={handleLightError}
        unoptimized
      />
      {/* Dark portrait */}
      <Image
        src={`/images/team/${agent.slug}-dark.png`}
        alt={`${agent.name} \u2014 dark realm portrait`}
        width={512}
        height={512}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out motion-reduce:transition-none"
        style={{ opacity: isDark ? 1 : 0 }}
        onError={handleDarkError}
        unoptimized
      />
    </>
  );
}

/** Hover overlay effect matched to agent personality. */
function HoverOverlay({ effect }: { effect: HoverEffect }): React.ReactElement {
  const cls: Record<HoverEffect, string> = {
    glow: "about-hover-glow",
    shimmer: "about-hover-shimmer",
    fire: "about-hover-fire",
    glitch: "about-hover-glitch",
    scan: "about-hover-scan",
  };

  return (
    <div
      className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${cls[effect]}`}
      aria-hidden="true"
    />
  );
}

// ── Realm badge ──────────────────────────────────────────────────────────────

/** Badge below portrait showing current realm. Crossfades with theme. */
function RealmBadge(): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="relative h-7" aria-live="polite">
      {/* Light realm badge */}
      <span
        className="absolute inset-0 inline-flex items-center justify-center gap-1.5
                   border border-border px-3 py-1
                   font-mono text-[10px] font-bold uppercase tracking-[0.12em]
                   text-foreground/70
                   transition-opacity duration-500 ease-in-out motion-reduce:transition-none"
        style={{ opacity: isDark ? 0 : 1 }}
        aria-hidden={isDark}
      >
        <span aria-hidden="true">{"\u2600"}</span>
        LJOSALFAR &middot; ALFHEIM
      </span>
      {/* Dark realm badge */}
      <span
        className="absolute inset-0 inline-flex items-center justify-center gap-1.5
                   border border-border px-3 py-1
                   font-mono text-[10px] font-bold uppercase tracking-[0.12em]
                   text-foreground/70
                   transition-opacity duration-500 ease-in-out motion-reduce:transition-none"
        style={{ opacity: isDark ? 1 : 0 }}
        aria-hidden={!isDark}
      >
        <span aria-hidden="true">{"\u263D"}</span>
        SVARTALFAR &middot; SVARTALFHEIM
      </span>
    </div>
  );
}

// ── Realm lore block ─────────────────────────────────────────────────────────

/** Dual-realm lore text with crossfade. Both always rendered, one opacity:0. */
function RealmLore({
  lightLore,
  darkLore,
}: {
  lightLore: RealmLoreData;
  darkLore: RealmLoreData;
}): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="relative min-h-[120px]">
      {/* Light realm lore */}
      <div
        className="border-l-[3px] border-primary/60 pl-5 py-4 flex flex-col gap-2
                   transition-opacity duration-500 ease-in-out motion-reduce:transition-none"
        style={{ opacity: isDark ? 0 : 1 }}
        aria-hidden={isDark}
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50">
          {"\u2600"} {lightLore.title}
        </span>
        <p className="font-body text-sm leading-relaxed italic text-muted-foreground">
          &ldquo;{lightLore.quote}&rdquo;
        </p>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground/40">
          {lightLore.aspect}
        </span>
      </div>
      {/* Dark realm lore */}
      <div
        className="absolute top-0 left-0 w-full
                   border-l-[3px] border-primary/60 pl-5 py-4 flex flex-col gap-2
                   transition-opacity duration-500 ease-in-out motion-reduce:transition-none"
        style={{ opacity: isDark ? 1 : 0 }}
        aria-hidden={!isDark}
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50">
          {"\u263D"} {darkLore.title}
        </span>
        <p className="font-body text-sm leading-relaxed italic text-muted-foreground">
          &ldquo;{darkLore.quote}&rdquo;
        </p>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground/40">
          {darkLore.aspect}
        </span>
      </div>
    </div>
  );
}

// ── Agent myth row ───────────────────────────────────────────────────────────

/** Single agent row: portrait flanks text, alternating L/R by index. */
function AgentMythRow({
  agent,
  index,
}: {
  agent: AgentProfile;
  index: number;
}): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const isOdd = index % 2 !== 0;

  return (
    <motion.article
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={isOdd ? ROW_FROM_RIGHT : ROW_FROM_LEFT}
      aria-label={`${agent.name} \u2014 ${agent.role}`}
      className={`flex gap-12 py-14 border-b border-border last:border-b-0
                  ${isOdd ? "flex-row-reverse" : "flex-row"}
                  max-md:!flex-col max-md:items-center max-md:gap-7`}
    >
      {/* Portrait column */}
      <motion.div
        variants={ROW_STAGGER}
        className="group flex-shrink-0 flex flex-col items-center gap-4 relative"
      >
        <motion.div variants={CHILD_FADE}>
          <div className="relative w-[340px] h-[340px] max-md:w-[280px] max-md:h-[280px] border-2 border-border overflow-hidden">
            <DualRealmPortrait agent={agent} />

            {/* Rune badge — top-right corner */}
            <span
              className="absolute top-3 right-3 text-[28px] opacity-25
                         group-hover:opacity-70 transition-opacity duration-300
                         font-heading text-primary"
              aria-hidden="true"
            >
              {agent.rune}
            </span>

            {/* Personality-specific hover overlay */}
            <HoverOverlay effect={agent.hoverEffect} />
          </div>
        </motion.div>

        {/* Realm badge */}
        <motion.div variants={CHILD_FADE}>
          <RealmBadge />
        </motion.div>
      </motion.div>

      {/* Text column */}
      <motion.div
        variants={ROW_STAGGER}
        className="flex-1 flex flex-col gap-5 pt-2 max-md:pt-0"
      >
        <motion.div variants={CHILD_FADE}>
          <h3 className="font-heading text-[32px] font-bold leading-none text-foreground max-md:text-[26px]">
            {agent.name}
          </h3>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-foreground/60 mt-2">
            {agent.role}
          </p>
        </motion.div>

        <motion.p
          variants={CHILD_FADE}
          className="font-body text-[15px] leading-[1.7] text-muted-foreground"
        >
          {agent.bio}
        </motion.p>

        <motion.div variants={CHILD_FADE}>
          <RealmLore lightLore={agent.lightLore} darkLore={agent.darkLore} />
        </motion.div>
      </motion.div>
    </motion.article>
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

// ── Section: The Myth with Agents (Issue #633) ──────────────────────────────

function TheMythWithAgentsSection(): React.ReactElement {
  return (
    <AnimatedSection
      label="The agents of Asgard"
      className="border-b border-border bg-card"
    >
      <div className="max-w-[1200px] mx-auto px-6 py-14 sm:py-20">
        {/* Section intro */}
        <div className="text-center max-w-[700px] mx-auto mb-16">
          <motion.p
            variants={FADE_UP}
            className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-3"
          >
            {RUNE.tiwaz} &mdash; The Pack
          </motion.p>
          <motion.h2
            variants={FADE_UP}
            className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground mb-4"
          >
            The Agents of Asgard
          </motion.h2>
          <motion.p
            variants={FADE_UP}
            className="font-body text-base text-muted-foreground leading-relaxed"
          >
            Fenrir Ledger is built entirely by AI agents. Each carries a dual
            nature &mdash; a light face for construction, a shadow face for the
            hunt. The theme toggle doesn&apos;t just change colors. It reveals
            which realm you&apos;re peering into.
          </motion.p>
        </div>

        {/* Agent rows */}
        {AGENTS.map((agent, i) => (
          <div key={agent.slug}>
            <AgentMythRow agent={agent} index={i} />

            {/* Heimdall Data Protection subsection */}
            {agent.slug === "heimdall" && (
              <div className="max-w-[900px] mx-auto px-6 py-8">
                <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
                  Heimdall stands at the boundary between what Fenrir knows and
                  what it must never know. The distinction between card metadata
                  and payment credentials is not a policy — it is an
                  architectural guarantee.
                </p>
                <DataSafetyBanner
                  variant="inline"
                  ariaLabel="Heimdall data protection guarantee"
                  headingOverride="What Heimdall Guards"
                  descriptionOverride="The boundary Heimdall defends separates card metadata (what Fenrir tracks) from payment credentials (what Fenrir never touches). Credit card numbers, CVVs, PINs, passwords, SSNs, and bank account numbers are architecturally excluded — not filtered, not redacted, not present."
                />
              </div>
            )}

            {i < AGENTS.length - 1 && AGENT_DIVIDERS[i] && (
              <div
                className="text-center font-heading text-xl tracking-[0.5em] opacity-20 py-6"
                aria-hidden="true"
              >
                {AGENT_DIVIDERS[i]}
              </div>
            )}
          </div>
        ))}
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
      <TheMythWithAgentsSection />
      <TheForgeSection />
      <FinalCtaSection />
    </>
  );
}
