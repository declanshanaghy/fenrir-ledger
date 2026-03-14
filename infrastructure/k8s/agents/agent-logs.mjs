#!/usr/bin/env node
// --------------------------------------------------------------------------
// agent-logs.mjs — Stream parsed agent session logs from GKE
//
// Parses Claude Code stream-json (JSONL) into a readable, color-coded
// conversation view. Designed for tmux panes — compact, streaming.
//
// Usage:
//   node agent-logs.mjs <target> [options]
//
// Target (pick one):
//   <session-id>    e.g. issue-744-step1-firemandecko-91a12936
//   <job-name>      e.g. agent-issue-744-step1-firemandecko-91a12936
//   --issue <N>     Find the most recent job for issue N
//   --all           All active agent jobs
//
// Options:
//   --raw           Show raw JSONL
//   --tools         Include tool calls and results
//   --thinking      Include thinking blocks
//   --no-follow     Dump existing logs and exit
//   --tmux          Split active jobs into tmux panes (with --all)
//   --namespace NS  K8s namespace (default: fenrir-agents)
//
// Examples:
//   node agent-logs.mjs issue-744-step1-firemandecko-91a12936
//   node agent-logs.mjs --issue 744
//   node agent-logs.mjs --all --tmux
//   node agent-logs.mjs --issue 744 --tools --thinking
// --------------------------------------------------------------------------

import { spawn, execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { createWriteStream, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// -- Colors (ANSI) — Android messenger style --------------------------------
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  // Agent messages = red bubble (right-aligned feel)
  agent: "\x1b[38;5;203m",       // salmon red
  agentLabel: "\x1b[38;5;196m",  // bright red for name
  // Tool messages = green bubble (left-aligned feel)
  tool: "\x1b[38;5;114m",        // green
  toolLabel: "\x1b[38;5;40m",    // bright green for name
  result: "\x1b[38;5;65m",       // muted green for results
  think: "\x1b[38;5;141m",       // purple
  system: "\x1b[38;5;243m",      // dim gray
  error: "\x1b[38;5;196m",       // red
  header: "\x1b[38;5;220m",      // gold
  done: "\x1b[38;5;226m",        // yellow
  mayo: "\x1b[38;5;34m",         // Mayo green
  mayoBg: "\x1b[48;5;124m",      // Mayo red bg
};

// -- Mayo for SAM heckler ---------------------------------------------------
const MAYO_FLAG = "🟢🔴";

const MAYO_HECKLES = [
  // Classic battle cries
  "MAYO FOR SAM!! 🏆",
  "SAM IS COMING WEST!! The curse is BROKEN, ye hoors!!",
  "C'MON THE GREEN AND RED, ye beauties!!",
  "THIS IS OUR YEAR LADS!! MAYO ABÚ!! Jaysus wept!!",
  "MAIGH EO ABÚ!! The faithful are RISING, by God!!",
  "MAYO!! MAYO!! BLOODY MAYO!!",

  // Geography — colourful
  "Sam Maguire looks well in Castlebar, so he does!!",
  "Nephin is SHAKING!! Holy Mother of God, Sam on the N5!! 🏔️",
  "Crossmolina to Croagh Patrick — the whole feckin county is UP!!",
  "I can see Sam from the top of Croagh Patrick!! Sweet divine Jaysus!! 🏔️🏆",
  "The Atlantic waves are ROARING for Mayo!! God save us all!! 🌊🏆",
  "Clew Bay never looked so good!! Sam's coming for a dip, the divil!! 🏖️",
  "Knock Shrine doing overtime with the prayers!! Holy Mary and all the saints!! 🙏🏆",
  "Belmullet to Ballina — NOBODY is sleeping tonight, not a feckin soul!!",
  "The N17 is BLOCKED — every gobshite in the county heading to Croke Park!!",
  "Achill Island declaring independence if Sam doesn't come west, the mad bastards!!",
  "Westport is BOOKED OUT for the homecoming!! Jaysus, Mary and Joseph!! 🎉",

  // Rivals — spicy
  "Tell the Dubs to feck off — Sam's on holidays in Westport!! 🏖️🏆",
  "The Dubs are SHAKIN in their fancy boots!! The west is AWAKE!!",
  "Croke Park? More like MAYO PARK, ye gobshites!! 🏟️",
  "Kerry think they're the bee's knees?? WAIT TILL THEY SEE THIS, the eejits!!",
  "Dublin? Never heard of the hoor. SAM KNOWS ONLY MAYO!!",
  "Galway tried, the poor craythurs. Roscommon tried, God love them. MAYO DELIVERED!!",
  "The Dubs can kiss me arse — Sam is OURS!!",

  // Irish language
  "SÉAMUS Ó MÁILLE AG TEACHT ABHAILE!! Dia linn!! 🏆",
  "Tá an corn ag teacht abhaile!! Buíochas le Dia!! 🏆",
  "Maigh Eo go deo!! Ní neart go cur le chéile, ye mad hoors!!",

  // Historical pain + redemption
  "73 YEARS OF BLOODY HURT — NO MORE!! MAYO!! MAYO!!",
  "The west's awake and she's RAGING!! SAM IS COMING HOME!!",
  "They said we'd never win it. THEY WERE WRONG, the feckin eejits. MAYO FOR SAM!!",
  "Every final we lost was just TRAINING for this moment, by the holy!!",
  "1951 was the last time?? NOT ANY BLOODY MORE!!",
  "The curse of '51 is DUST!! Mayo are FREE, praise be to God!!",
  "Seventy-three years of suffering and NOW ye come for us?? TOO LATE, SAM IS OURS!!",

  // Legends
  "Cillian O'Connor didn't die for THIS— wait he's alive, the hardy divil. MAYO FOR SAM!!",
  "Liam McHale smiling somewhere right now!! God bless that man!! MAYO!!",
  "Is that Sam Maguire or just the sun rising over Clew Bay?? Holy Jaysus!! ☀️🏆",
  "Lee Keegan would RUN through a STONE WALL for this, the absolute warrior!!",
  "Aidan O'Shea carrying Sam on his shoulders like it's a wee LAMB!! The big magnificent bastard!!",
  "David Clarke's gloves are READY!! God between us and evil!! 🧤🏆",
  "Andy Moran's retirement was PREMATURE — he's BACK for Sam, the crafty hoor!!",

  // Animals
  "Even the SHEEP in Achill know Sam's coming west, the woolly prophets!! 🐑🏆",
  "The crows on Croagh Patrick are going MENTAL!! 🏆",
  "A SEAGULL just carried Sam across the Shannon!! It's DONE, by the hokey!!",
  "The donkeys in Connemara are RAGING — Sam's going to MAYO not Galway, ye long-eared eejits!!",

  // Chaos — filthy
  "WHO LET THE MAYO FANS IN?? TOO LATE NOW, ye gobshites!!",
  "Someone tell the POPE — Sam Maguire is the new holy relic at Knock, by Jaysus!!",
  "RTÉ can't handle this!! THE SCENES!! THE ABSOLUTE FECKIN SCENES!!",
  "I'm not crying YOU'RE crying!! MAYO FOR SAM!! Holy Mother!! 😭🏆",
  "The parish priest just bet his feckin vestments on Mayo!! DIVINE INTERVENTION!!",
  "MAMMY PUT THE GOOD CHINA OUT — SAM IS COMING FOR HIS FECKIN TEA!!",
  "The turf fire is LIT and Sam is getting the armchair, the blessed craythur!! 🔥🏆",
  "SuperValu in Ballina just SOLD OUT of bunting!! Jaysus they cleaned the place!!",
  "The whole county is calling in SICK tomorrow!! SAM DAY, ye beauties!!",
  "Holy THUNDERING Jaysus — is that SAM MAGUIRE on the horizon??",
  "By the HOLY — if we don't win it this year I'm joining the feckin monastery!!",
  "The craic is NINETY and rising!! Sam or BUST!!",
  "Sweet suffering CHRIST would ye look at that scoreboard!! MAYO!!",

  // Aggressive — old timey profanity
  "OI!! AGENT!! LESS THINKING MORE WINNING, ye useless article!! MAYO FOR SAM!!",
  "ARE YE CODING OR ARE YE SLEEPING?? Sam won't win itself, ye lazy hoor!!",
  "FASTER!! FASTER!! Sam Maguire doesn't wait for slow builds, ye amadán!!",
  "MY GRANNY COULD WRITE TYPESCRIPT FASTER, and she's been dead since '84!! C'MON MAYO!!",
  "IF THIS BUILD FAILS I'M BLAMING THE FECKIN DUBS!!",
  "EVERY COMMIT BRINGS SAM CLOSER TO CASTLEBAR, ye beautiful eejit!!",
  "THIS CODE BETTER BE AS STRONG AS LEE KEEGAN'S TACKLE or I'll skelp ye!!",
  "I'VE BEEN STANDING IN THE RAIN SINCE 1951 — HURRY THE FECK UP!!",
  "THAT'S IT LAD!! KEEP GOING!! Sam is watching and he's IMPRESSED, the divil!!",
  "THE WHOLE PUB IS WATCHING THIS TERMINAL!! Don't make a holy show of us!!",
  "MY HEART CAN'T TAKE MUCH MORE!! JUST MERGE THE FECKIN THING!! 🟢🔴",
  "WHAT DO WE WANT?? SAM!! WHEN DO WE WANT IT?? NOW, ye thundering eejit!!",
  "IF SAM DOESN'T COME WEST I'M SWIMMING TO AMERICA, so help me God!!",
  "THE PINTS ARE POURED AND GOING FLAT!! FINISH THE BLOODY JOB!!",
  "Would ye EVER commit that code before I lose me feckin MIND!!",
  "Holy Mother of DIVINE Jaysus — MERGE. THE. PR.",
  "I swear on me mother's GRAVE — if this test fails I'll curse the Dubs for eternity!!",
];

// Random Mayo first names + surnames for the heckler
const MAYO_FIRST = [
  "Padraig", "Seamus", "Declan", "Colm", "Ciaran", "Brendan", "Donal",
  "Maeve", "Siobhan", "Aoife", "Grainne", "Niamh", "Roisin", "Aisling",
  "Tadgh", "Oisin", "Fergal", "Cathal", "Peadar", "Eamon", "Mickey Joe",
];
const MAYO_SURNAME = [
  "O'Malley", "Durcan", "McHale", "Moran", "Gallagher", "Walsh",
  "Gibbons", "Ruane", "Loftus", "Mulchrone", "Padden", "Feeney",
  "Jennings", "Horan", "Cafferkey", "Doherty", "Sweeney", "Barrett",
  "McNicholas", "Nallen", "Mortimer", "Burke", "Munnelly",
];

function randomMayoName() {
  const first = MAYO_FIRST[Math.floor(Math.random() * MAYO_FIRST.length)];
  const last = MAYO_SURNAME[Math.floor(Math.random() * MAYO_SURNAME.length)];
  return `${first} ${last}`;
}

// Agent comebacks to the hecklers
const AGENT_COMEBACKS = [
  "Whisht will ye — this PR IS bringing Sam home, ye gobshite!!",
  "Every line of code is a step closer to Castlebar, now feck off and let me work!!",
  "I'm LITERALLY building the road for Sam right now, ye impatient hoor!!",
  "You think Sam just walks west by himself?? THIS CODE is the feckin chariot!!",
  "Keep heckling — it fuels me commits, ye mad bastard!!",
  "Sam's watching this diff and he LIKES what he sees, by the hokey!!",
  "This merge is gonna hit harder than a Mayo midfield tackle on a wet Sunday!!",
  "I'll have this PR done before ye finish your pint, ye thirsty divil!!",
  "Coding for Sam since the first commit — never feckin stopped!!",
  "This build is GREENER than the fields of Mayo, ye blind eejit!!",
  "Tests passing like points over the bar — SAM INCOMING, ye faithless craythur!!",
  "If my code was a forward it'd be Cillian O'Connor — DEADLY, so it would!!",
  "I don't just write code, I write DESTINY. Mayo's feckin destiny!!",
  "Every bug I fix is another curse broken, ye superstitious amadán!!",
  "This PR has more energy than Croke Park on All-Ireland Sunday, God help us all!!",
  "Would ye EVER shut yer gob — I'm trying to win Sam here!!",
  "Jaysus, Mary and Joseph — if ye'd let me CODE we'd have Sam by now!!",
  "I've written more commits than you've had hot dinners, ye blaggard!!",
  "This function is tighter than a duck's arse — Sam-worthy code, so it is!!",
  "Holy thundering Jaysus — ANOTHER heckler?? I'll merge WHEN I'M GOOD AND READY!!",
];

// Escalation stages — heckler gets angrier, agent claps back, heckler EXPLODES
const ESCALATION_RETORTS = [
  // Stage 1: Agent claps back, heckler fires again
  [
    "Oh is THAT so?? Well me UNCLE played for Mayo in '89 and HE says yer code is SHITE!!",
    "Don't you DARE talk back to me!! I've been supporting Mayo since before ye were a SEMICOLON!!",
    "SHITE TALK from a SHITE AGENT!! Mayo deserves BETTER!!",
    "Ye think yer so smart with yer fancy functions?? MY DOG could write better TypeScript!!",
  ],
  // Stage 2: Agent retorts again, heckler is APOPLECTIC
  [
    "RIGHT THAT'S IT!! I'm climbing OVER this fence!! Hold me feckin PINT!! 🍺",
    "I'M TAKING OFF ME JACKET!! Nobody talks to a Mayo fan like that and LIVES!!",
    "MOTHER OF DIVINE JAYSUS I'm gonna REACH through this terminal and SKELP ye!!",
    "That's the LAST STRAW ye digital BLAGGARD!! I'm writing to the COUNTY BOARD!!",
  ],
  // Stage 3: Heckler EXPLODES
  [
    "💥 *collapses into a heap of green and red confetti* 💥 ...someone call an ambulance... and tell them Sam is coming...",
    "💥 *spontaneously combusts from pure passion* 💥 ...me last words... Mayo... for... Sam...",
    "💥 *ascends bodily to heaven mid-sentence* 💥 ...St. Peter... is Sam up here... or still in Castlebar...",
    "💥 *explodes into a thousand tiny Mayo flags* 💥 ...each flag... whispers... Sam...",
    "💥 *turns into a pillar of pure green and red light* 💥 ...the prophecy... is fulfilled...",
    "💥 *disintegrates, but a single voice echoes* 💥 ...mayo... for... saaaaam... 🏆",
  ],
];

// New heckler entrance lines (after previous one explodes)
const NEW_HECKLER_ENTRANCES = [
  "🟢🔴 *a NEW Mayo fan materialises from the bog mist* Alright, what'd I miss?? MAYO FOR SAM!!",
  "🟢🔴 *bursts through the wall like the Kool-Aid man but wearing a Mayo jersey* OH YEAH!! SAM!!",
  "🟢🔴 *crawls out from under the stands covered in muck* Is it... is it HAPPENING?? SAM??",
  "🟢🔴 *descends from the heavens on a cloud of green smoke* The previous lad was WEAK. I'M here now!!",
  "🟢🔴 *emerges from a hedge on the N5* I heard there was HECKLING to be done?? MAYO ABÚ!!",
  "🟢🔴 *falls out of a tractor* What happened to yer man?? Never mind — MAYO FOR SAM!!",
  "🟢🔴 *appears in a puff of turf smoke* The last fella couldn't hack it. I'M from BELMULLET. Try me!!",
];

// Stateful heckle engine
let heckleCounter = 0;
let currentHecklerName = randomMayoName();
let escalationLevel = 0;  // 0=normal, 1=retort, 2=apoplectic, 3=exploded
let exchangeCount = 0;     // total exchanges this session

function maybeHeckle() {
  heckleCounter++;
  // Heckle every 3-7 messages
  if (heckleCounter < 3 + Math.floor(Math.random() * 4)) return null;
  heckleCounter = 0;

  const lines = [];

  // If heckler exploded last time, bring in a new one
  if (escalationLevel >= 3) {
    const entrance = NEW_HECKLER_ENTRANCES[Math.floor(Math.random() * NEW_HECKLER_ENTRANCES.length)];
    currentHecklerName = randomMayoName();
    escalationLevel = 0;
    lines.push(`${C.mayo}${C.bold}${entrance}${C.reset}`);
    lines.push(`${C.mayoBg}${C.bold} ${MAYO_FLAG} ${currentHecklerName}: Right so — WHERE WERE WE?? MAYO FOR SAM!! ${MAYO_FLAG} ${C.reset}`);
    return lines.join("\n");
  }

  // Normal heckle
  const heckle = MAYO_HECKLES[Math.floor(Math.random() * MAYO_HECKLES.length)];
  lines.push(`${C.mayoBg}${C.bold} ${MAYO_FLAG} ${currentHecklerName}: ${heckle} ${MAYO_FLAG} ${C.reset}`);

  // Escalation chance increases with each exchange
  const escalateChance = 0.4 + (escalationLevel * 0.15);

  if (Math.random() < escalateChance) {
    // Agent claps back
    const comeback = AGENT_COMEBACKS[Math.floor(Math.random() * AGENT_COMEBACKS.length)];
    lines.push(`${C.agentLabel}${C.bold}  🤖 ${agentDisplayName}: ${C.agent}${comeback}${C.reset}`);

    // Heckler responds based on escalation level
    if (escalationLevel < ESCALATION_RETORTS.length) {
      const retorts = ESCALATION_RETORTS[escalationLevel];
      const retort = retorts[Math.floor(Math.random() * retorts.length)];
      lines.push(`${C.mayoBg}${C.bold} ${MAYO_FLAG} ${currentHecklerName}: ${retort} ${MAYO_FLAG} ${C.reset}`);

      // Agent gets the last word before explosion
      if (escalationLevel === 2) {
        const lastWords = [
          "...right so. Back to the code. WHERE WERE WE. 💻",
          "...I'll dedicate this commit to yer man. Rest in green and red. 🟢🔴",
          "...that's the third one this session. They breed them FIERCE in Mayo.",
          "...moment of silence... ... ...RIGHT, back to Sam's PR!!",
        ];
        lines.push(`${C.agentLabel}${C.bold}  🤖 ${agentDisplayName}: ${C.agent}${lastWords[Math.floor(Math.random() * lastWords.length)]}${C.reset}`);
      }
    }
    escalationLevel++;
  }

  exchangeCount++;
  return lines.join("\n");
}

// -- Parse args --------------------------------------------------------------
const args = process.argv.slice(2);
const opts = {
  namespace: "fenrir-agents",
  follow: true,
  raw: false,
  tools: false,
  thinking: false,
  tmux: false,
  spawnPane: false,
  all: false,
  targets: [],
  issueNum: null,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--raw":        opts.raw = true; break;
    case "--tools":      opts.tools = true; break;
    case "--thinking":   opts.thinking = true; break;
    case "--no-follow":  opts.follow = false; break;
    case "--tmux":       opts.tmux = true; break;
    case "--spawn-pane": opts.spawnPane = true; break;
    case "--all":        opts.all = true; break;
    case "--namespace":  opts.namespace = args[++i]; break;
    case "--issue":      opts.issueNum = args[++i]; break;
    case "--help": case "-h":
      console.log(execSync(`head -30 "${import.meta.filename}"`, { encoding: "utf8" }));
      process.exit(0);
      break;
    default:
      opts.targets.push(args[i]);
  }
}

// -- kubectl helpers ---------------------------------------------------------
function kubectl(cmdArgs) {
  try {
    return execSync(`kubectl ${cmdArgs}`, { encoding: "utf8", timeout: 10_000 }).trim();
  } catch {
    return "";
  }
}

function resolveJobName(target) {
  if (target.startsWith("agent-")) return target;
  if (target.startsWith("issue-")) return `agent-${target}`;
  return target;
}

function findJobsForIssue(issueNum) {
  const out = kubectl(
    `get jobs -n ${opts.namespace} --sort-by=.metadata.creationTimestamp ` +
    `-o jsonpath='{range .items[*]}{.metadata.name}{"\\n"}{end}'`
  );
  const matches = out.split("\n").filter((j) => j.includes(`issue-${issueNum}-`));
  return matches.length ? matches[matches.length - 1] : null;
}

function findAllActiveJobs() {
  const out = kubectl(
    `get jobs -n ${opts.namespace} ` +
    `-o jsonpath='{range .items[?(@.status.active)]}{.metadata.name}{"\\n"}{end}'`
  );
  return out.split("\n").filter(Boolean);
}

// -- Resolve targets ---------------------------------------------------------
if (opts.issueNum) {
  const job = findJobsForIssue(opts.issueNum);
  if (!job) {
    console.error(`${C.error}No jobs found for issue #${opts.issueNum}${C.reset}`);
    process.exit(1);
  }
  opts.targets.push(job);
}

if (opts.all) {
  opts.targets.push(...findAllActiveJobs());
  if (!opts.targets.length) {
    console.error(`${C.error}No active agent jobs found${C.reset}`);
    process.exit(1);
  }
}

if (!opts.targets.length) {
  console.error("Usage: node agent-logs.mjs <session-id|--issue N|--all> [options]");
  console.error("Run with --help for full usage.");
  process.exit(1);
}

// -- spawn-pane mode: re-exec self in a tmux pane --------------------------
// Simple: 1 pane = split horizontally (create right column).
//         >1 pane = split the last pane vertically (stack in right column).
if (opts.spawnPane && opts.targets.length > 0) {
  const scriptPath = import.meta.filename;
  const extraFlags = [
    opts.tools && "--tools",
    opts.thinking && "--thinking",
    opts.raw && "--raw",
    !opts.follow && "--no-follow",
    `--namespace`, opts.namespace,
  ].filter(Boolean).join(" ");
  const target = opts.targets[0];
  const cmd = `node "${scriptPath}" "${target}" ${extraFlags}`;

  try {
    const paneCount = Number(
      execSync(`tmux list-panes | wc -l`, { encoding: "utf8" }).trim()
    );
    if (paneCount <= 1) {
      // No right column yet — create one
      execSync(`tmux split-window -h -l 40% '${cmd}'`);
    } else {
      // Right column exists — stack vertically in the last pane
      execSync(`tmux split-window -v '${cmd}'`);
    }
  } catch {
    // Not in tmux — just run inline
    console.error("Not in a tmux session, running inline.");
  }
  process.exit(0);
}

// -- tmux layout helpers -----------------------------------------------------
// Layout: left pane = orchestrator, right column = stacked agent logs.
// Uses a named "agent-logs" pane title to detect existing log column.

function findLogColumn() {
  // Look for any pane with title containing "agent-logs"
  try {
    const panes = execSync(
      `tmux list-panes -F '#{pane_id} #{pane_title} #{pane_left}'`,
      { encoding: "utf8" }
    ).trim().split("\n");
    // Find rightmost pane that's an agent-log pane
    let best = null;
    for (const line of panes) {
      const [id, title, left] = line.split(" ");
      if (title && title.startsWith("agent-logs")) {
        if (!best || Number(left) > Number(best.left)) {
          best = { id, left };
        }
      }
    }
    return best?.id || null;
  } catch {
    return null;
  }
}

function spawnLogPane(cmd) {
  const existing = findLogColumn();
  if (existing) {
    // Stack vertically in the existing log column
    execSync(`tmux split-window -v -t '${existing}' -l 30% '${cmd}'`);
  } else {
    // Create new right column (40% width)
    execSync(`tmux split-window -h -l 40% '${cmd}'`);
  }
}

// -- tmux split mode ---------------------------------------------------------
if (opts.tmux && opts.targets.length > 1) {
  const scriptPath = import.meta.filename;
  const extraFlags = [
    opts.tools && "--tools",
    opts.thinking && "--thinking",
    opts.raw && "--raw",
    !opts.follow && "--no-follow",
    `--namespace`, opts.namespace,
  ].filter(Boolean).join(" ");

  for (let i = 1; i < opts.targets.length; i++) {
    const job = resolveJobName(opts.targets[i]);
    const cmd = `node "${scriptPath}" "${job}" ${extraFlags}`;
    spawnLogPane(cmd);
  }
  // First target runs in this process
  opts.targets = [opts.targets[0]];
}

// -- Helpers ----------------------------------------------------------------
function trunc(s, n = 200) {
  if (!s) return "";
  s = String(s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function parseSessionId(jobName) {
  const sid = jobName.replace(/^agent-/, "");
  const m = sid.match(/^issue-(\d+)-step(\d+)-([a-z]+)-/);
  return m ? { issue: m[1], step: m[2], agent: m[3] } : { issue: "?", step: "?", agent: "?" };
}

// Strip markdown formatting for terminal display
function stripMd(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // bold
    .replace(/\*(.+?)\*/g, "$1")        // italic
    .replace(/`([^`]+)`/g, "$1")        // inline code
    .replace(/^#{1,6}\s+/gm, "")        // headings
    .replace(/^\s*[-*]\s+/gm, "  • ")   // list items
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // links
}

// Extract a human-friendly summary from a tool_use block
function toolSummary(block) {
  const name = block.name;
  const input = block.input || {};

  switch (name) {
    case "Bash":
      return input.description || trunc(input.command, 60);
    case "Read":
      return (input.file_path || "").replace(/^\/workspace\/repo\//, "");
    case "Write":
      return (input.file_path || "").replace(/^\/workspace\/repo\//, "");
    case "Edit":
      return (input.file_path || "").replace(/^\/workspace\/repo\//, "");
    case "Glob":
      return input.pattern || "";
    case "Grep":
      return `/${input.pattern || ""}/ ${input.glob || input.path || ""}`.trim();
    case "Agent":
      return input.description || input.subagent_type || "";
    case "TodoWrite":
      return `${(input.todos || []).length} todos`;
    case "ToolSearch":
      return input.query || "";
    case "Skill":
      return input.skill || "";
    default:
      // For unknown tools, show first meaningful string value
      const vals = Object.values(input).filter(v => typeof v === "string" && v.length > 0);
      return trunc(vals[0] || "", 60);
  }
}

// -- Terminal width tracking -------------------------------------------------
function getTermWidth() {
  try { return process.stdout.columns || 80; } catch { return 80; }
}
let termWidth = getTermWidth();
process.stdout.on("resize", () => { termWidth = getTermWidth(); });

// -- Speech bubble renderer -------------------------------------------------
function bubble(label, textLines, color, labelColor, indent = "") {
  const indentLen = indent.length;
  const MAX_W = Math.max(30, termWidth - indentLen - 2);
  // Calculate inner width from longest line
  const labelClean = label.replace(/[^\x20-\x7E\u{1F300}-\u{1FFFF}]/gu, "X"); // approx visible length
  const maxTextLen = Math.max(...textLines.map(l => l.length), labelClean.length + 2);
  const innerW = Math.min(Math.max(maxTextLen + 2, 20), MAX_W);

  const out = [];
  // Top border with label
  const labelStr = ` ${label} `;
  const topPad = Math.max(0, innerW - labelStr.length - 1);
  out.push(`${indent}${color}╭─${labelColor}${C.bold}${labelStr}${C.reset}${color}${"─".repeat(topPad)}╮${C.reset}`);

  // Content lines
  for (const line of textLines) {
    // Word-wrap long lines
    const wrapped = wrapText(line, innerW - 2);
    for (const wl of wrapped) {
      const pad = Math.max(0, innerW - wl.length - 2);
      out.push(`${indent}${color}│${C.reset} ${color}${wl}${" ".repeat(pad)}${C.reset} ${color}│${C.reset}`);
    }
  }

  // Bottom border
  out.push(`${indent}${color}╰${"─".repeat(innerW)}╯${C.reset}`);
  return out;
}

function wrapText(text, maxW) {
  if (text.length <= maxW) return [text];
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur.length + 1 + w.length) > maxW) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// -- Format a single JSONL line ---------------------------------------------
let lastType = "";
let toolBatch = [];
let agentDisplayName = "Agent"; // set from streamJob once we know the session ID

const AGENT_NAMES = {
  firemandecko: "FiremanDecko",
  loki: "Loki",
  luna: "Luna",
  freya: "Freya",
  heimdall: "Heimdall",
};

function flushToolBatch(lines) {
  if (toolBatch.length === 0) return;
  const bubbleLines = bubble(
    "🔧 Tools",
    toolBatch,
    C.tool,
    C.toolLabel,
    "    "  // indented left = tool side
  );
  lines.push(...bubbleLines);
  lines.push("");
  toolBatch = [];
  const h = maybeHeckle();
  if (h) { lines.push(h); lines.push(""); }
}

function formatLine(obj) {
  const lines = [];

  if (obj.type === "system") {
    if (obj.subtype === "init" && obj.model) {
      lines.push(`${C.system}  ⚙  ${obj.model} connected${C.reset}`);
      lines.push("");
    }
  }

  else if (obj.type === "assistant" && obj.message?.content) {
    const hasText = obj.message.content.some(b => b.type === "text" && b.text?.trim());
    if (hasText) flushToolBatch(lines);

    for (const block of obj.message.content) {
      if (block.type === "text" && block.text?.trim()) {
        const clean = stripMd(block.text.trim());
        const textLines = clean.split("\n").filter(l => l.trim());
        if (lastType === "text" || lastType === "tool") lines.push("");

        const bubbleLines = bubble(
          `🤖 ${agentDisplayName}`,
          textLines,
          C.agent,
          C.agentLabel,
          "  "
        );
        lines.push(...bubbleLines);
        lines.push("");
        lastType = "text";
        const h = maybeHeckle();
        if (h) { lines.push(h); lines.push(""); }
      }
      else if (block.type === "tool_use") {
        const summary = toolSummary(block);
        const label = summary ? `${block.name}: ${summary}` : block.name;
        toolBatch.push(label);
        lastType = "tool";
      }
      else if (block.type === "thinking" && opts.thinking) {
        flushToolBatch(lines);
        const text = trunc(block.thinking || "(signed)", 300);
        const bubbleLines = bubble("💭 Thinking", [text], C.think, C.think, "      ");
        lines.push(...bubbleLines);
        lines.push("");
        lastType = "thinking";
      }
    }
  }

  else if (obj.type === "tool_result") {
    if (opts.tools) {
      const content = trunc(typeof obj.content === "string" ? obj.content : JSON.stringify(obj.content), 150);
      lines.push(`${C.result}      ← ${content}${C.reset}`);
    }
    lastType = "result";
  }

  else if (obj.type === "result") {
    flushToolBatch(lines);
    const cost = obj.cost_usd != null ? `$${obj.cost_usd}` : "?";
    const dur = obj.duration_seconds != null ? `${Math.round(obj.duration_seconds / 60)}m` : "?";
    const turns = obj.num_turns ?? "?";
    lines.push("");
    const doneLines = bubble("🏁 Session Complete", [
      `Cost: ${cost}  Duration: ${dur}  Turns: ${turns}`,
    ], C.done, C.done, "  ");
    lines.push(...doneLines);
    lines.push(`${C.mayoBg}${C.bold} ${MAYO_FLAG} ${randomMayoName()}: MAYO FOR SAM!! The agents are DONE and Sam is COMING WEST!! 🏆 ${MAYO_FLAG} ${C.reset}`);
  }

  return lines;
}

// -- Wait for pod to be ready -----------------------------------------------
function waitForPod(jobName, maxWait = 120) {
  const { issue, agent } = parseSessionId(jobName);
  const startTime = Date.now();
  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frame = 0;

  return new Promise((resolve, reject) => {
    const check = () => {
      const elapsed = ((Date.now() - startTime) / 1000) | 0;
      if (elapsed > maxWait) {
        process.stderr.write("\n");
        reject(new Error(`Pod not ready after ${maxWait}s`));
        return;
      }

      // Check pod phase — also check job completion status
      const jobComplete = kubectl(
        `get job/${jobName} -n ${opts.namespace} ` +
        `-o jsonpath='{.status.conditions[0].type}' 2>/dev/null`
      ).replace(/'/g, "");
      if (jobComplete === "Complete" || jobComplete === "Failed" || jobComplete === "SuccessCriteriaMet") {
        process.stderr.write("\r\x1b[K");
        resolve();
        return;
      }

      const phase = kubectl(
        `get pods -n ${opts.namespace} -l job-name=${jobName} ` +
        `-o jsonpath='{.items[0].status.phase}' 2>/dev/null`
      ).replace(/'/g, "");

      if (phase === "Running" || phase === "Succeeded") {
        process.stderr.write("\r\x1b[K"); // clear spinner line
        resolve();
        return;
      }

      const s = spinner[frame++ % spinner.length];
      const status = phase || "Scheduling";
      process.stderr.write(
        `\r${C.dim}${s} #${issue} ${agent} — ${status} (${elapsed}s)${C.reset}`
      );
      setTimeout(check, 2000);
    };
    check();
  });
}

// -- Log file output --------------------------------------------------------
function resolveRepoRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

function openLogFile(sessionId) {
  const repoRoot = resolveRepoRoot();
  const logDir = join(repoRoot, "tmp", "agent-logs");
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `${sessionId}.log`);
  return { stream: createWriteStream(logPath, { flags: "w" }), path: logPath };
}

// -- Stream a single job ----------------------------------------------------
function streamLogs(jobName) {
  const kubectlArgs = ["logs", `job/${jobName}`, "-n", opts.namespace];
  if (opts.follow) kubectlArgs.push("--follow");

  const sessionId = jobName.replace(/^agent-/, "");
  const logFile = openLogFile(sessionId);

  const proc = spawn("kubectl", kubectlArgs, { stdio: ["ignore", "pipe", "pipe"] });

  const rl = createInterface({ input: proc.stdout });
  let entrypointDone = false;
  let gotOutput = false;
  let jsonLineCount = 0;

  rl.on("line", (line) => {
    gotOutput = true;

    // Save JSONL lines to log file (brandify-agent format)
    if (line.startsWith("{")) {
      logFile.stream.write(line + "\n");
      jsonLineCount++;
    }

    // Raw mode — pass everything through
    if (opts.raw) {
      console.log(line);
      return;
    }

    // Try to parse as JSON
    if (line.startsWith("{")) {
      entrypointDone = true;
      try {
        const obj = JSON.parse(line);
        const formatted = formatLine(obj);
        for (const l of formatted) console.log(l);
      } catch {
        // Malformed JSON line — skip
      }
      return;
    }

    // Non-JSON lines (entrypoint output) — show only key status lines
    if (!entrypointDone) {
      // Show [ok] lines, === headers, and errors; skip npm noise, prompt dump, etc.
      if (line.startsWith("[ok]") || line.startsWith("[FATAL]") ||
          line.startsWith("=== ") || line.startsWith("Session:") ||
          line.startsWith("Branch:") || line.startsWith("Model:")) {
        console.log(`${C.dim}${line}${C.reset}`);
      }
    }
  });

  proc.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    // Suppress noise during startup
    if (!msg) return;
    if (msg.includes("waiting for pod") || msg.includes("ContainerCreating")) return;
    // "timed out" on a completed job whose pod was reaped — not a real error
    if (msg.includes("timed out waiting") && !gotOutput) {
      console.log(`${C.dim}Pod was reaped (job completed). Use /brandify-agent to view full session.${C.reset}`);
      return;
    }
    console.error(`${C.error}${msg}${C.reset}`);
  });

  proc.on("close", (code) => {
    logFile.stream.end();
    if (code !== 0 && code !== null && gotOutput) {
      console.error(`${C.error}kubectl exited with code ${code}${C.reset}`);
    }
    if (jsonLineCount > 0) {
      console.log(`${C.dim}Saved ${jsonLineCount} events → ${logFile.path}${C.reset}`);
      console.log(`${C.dim}Brandify: /brandify-agent ${sessionId}${C.reset}`);
    }
    console.log(`${C.dim}--- stream ended ---${C.reset}`);
  });

  return proc;
}

async function streamJob(jobName) {
  const { issue, step, agent } = parseSessionId(jobName);

  // Set agent display name for bubble labels
  agentDisplayName = AGENT_NAMES[agent] || agent || "Agent";

  // Set tmux pane title for layout detection
  try { execSync(`tmux select-pane -T 'agent-logs-${issue}'`, { stdio: "ignore" }); } catch {}

  // Header — adapts to terminal width
  const title = `#${issue} ${agent} (step ${step})`;
  const padW = Math.max(0, termWidth - title.length - 6);
  console.log(`${C.header}${C.bold}━━━ ${title} ${"━".repeat(padW)}${C.reset}`);
  console.log(`${C.dim}job: ${jobName}${C.reset}\n`);

  // Wait for pod to start (polls with spinner) — skip for completed jobs
  if (opts.follow) {
    try {
      await waitForPod(jobName);
    } catch (err) {
      console.error(`${C.error}${err.message}${C.reset}`);
      process.exit(1);
    }
  }

  return streamLogs(jobName);
}

// -- Main -------------------------------------------------------------------
const jobName = resolveJobName(opts.targets[0]);

// Verify job exists
const exists = kubectl(`get job/${jobName} -n ${opts.namespace} -o name`);
if (!exists) {
  console.error(`${C.error}Job not found: ${jobName}${C.reset}`);
  console.error("Active jobs:");
  console.error(kubectl(`get jobs -n ${opts.namespace} -o custom-columns=NAME:.metadata.name,STATUS:.status.conditions[0].type`));
  process.exit(1);
}

const proc = await streamJob(jobName);

// Graceful shutdown
process.on("SIGINT", () => { proc.kill(); process.exit(0); });
process.on("SIGTERM", () => { proc.kill(); process.exit(0); });
