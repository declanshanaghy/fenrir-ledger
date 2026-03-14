// --------------------------------------------------------------------------
// mayo-heckler.mjs — Shared Mayo heckler engine
//
// Used by both agent-logs.mjs (CLI) and agent-monitor SPA (browser).
// Exports the heckler state machine, heckle data, and escalation logic.
//
// Usage (Node.js):
//   import { createHecklerEngine } from './mayo-heckler.mjs';
//   const engine = createHecklerEngine();
//   const events = engine.maybeHeckle(); // returns array of events or null
//
// Usage (browser — inline via <script type="module">):
//   Copy HECKLE_DATA export and createHecklerEngine function.
// --------------------------------------------------------------------------

export const MAYO_HECKLES = [
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

export const AGENT_COMEBACKS = [
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

export const ESCALATION_RETORTS = [
  [
    "Oh is THAT so?? Well me UNCLE played for Mayo in '89 and HE says yer code is SHITE!!",
    "Don't you DARE talk back to me!! I've been supporting Mayo since before ye were a SEMICOLON!!",
    "SHITE TALK from a SHITE AGENT!! Mayo deserves BETTER!!",
    "Ye think yer so smart with yer fancy functions?? MY DOG could write better TypeScript!!",
  ],
  [
    "RIGHT THAT'S IT!! I'm climbing OVER this fence!! Hold me feckin PINT!! 🍺",
    "I'M TAKING OFF ME JACKET!! Nobody talks to a Mayo fan like that and LIVES!!",
    "MOTHER OF DIVINE JAYSUS I'm gonna REACH through this terminal and SKELP ye!!",
    "That's the LAST STRAW ye digital BLAGGARD!! I'm writing to the COUNTY BOARD!!",
  ],
  [
    "💥 *collapses into a heap of green and red confetti* 💥 ...someone call an ambulance... and tell them Sam is coming...",
    "💥 *spontaneously combusts from pure passion* 💥 ...me last words... Mayo... for... Sam...",
    "💥 *ascends bodily to heaven mid-sentence* 💥 ...St. Peter... is Sam up here... or still in Castlebar...",
    "💥 *explodes into a thousand tiny Mayo flags* 💥 ...each flag... whispers... Sam...",
    "💥 *turns into a pillar of pure green and red light* 💥 ...the prophecy... is fulfilled...",
    "💥 *disintegrates, but a single voice echoes* 💥 ...mayo... for... saaaaam... 🏆",
  ],
];

export const NEW_HECKLER_ENTRANCES = [
  "🟢🔴 *a NEW Mayo fan materialises from the bog mist* Alright, what'd I miss?? MAYO FOR SAM!!",
  "🟢🔴 *bursts through the wall like the Kool-Aid man but wearing a Mayo jersey* OH YEAH!! SAM!!",
  "🟢🔴 *crawls out from under the stands covered in muck* Is it... is it HAPPENING?? SAM??",
  "🟢🔴 *descends from the heavens on a cloud of green smoke* The previous lad was WEAK. I'M here now!!",
  "🟢🔴 *emerges from a hedge on the N5* I heard there was HECKLING to be done?? MAYO ABÚ!!",
  "🟢🔴 *falls out of a tractor* What happened to yer man?? Never mind — MAYO FOR SAM!!",
  "🟢🔴 *appears in a puff of turf smoke* The last fella couldn't hack it. I'M from BELMULLET. Try me!!",
];

export const MAYO_FIRST = [
  "Padraig", "Seamus", "Declan", "Colm", "Ciaran", "Brendan", "Donal",
  "Maeve", "Siobhan", "Aoife", "Grainne", "Niamh", "Roisin", "Aisling",
  "Tadgh", "Oisin", "Fergal", "Cathal", "Peadar", "Eamon", "Mickey Joe",
];

export const MAYO_SURNAME = [
  "O'Malley", "Durcan", "McHale", "Moran", "Gallagher", "Walsh",
  "Gibbons", "Ruane", "Loftus", "Mulchrone", "Padden", "Feeney",
  "Jennings", "Horan", "Cafferkey", "Doherty", "Sweeney", "Barrett",
  "McNicholas", "Nallen", "Mortimer", "Burke", "Munnelly",
];

export const AGENT_NAMES = {
  firemandecko: "FiremanDecko",
  loki: "Loki",
  luna: "Luna",
  freya: "Freya",
  heimdall: "Heimdall",
};

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function randomMayoName() {
  return `${pick(MAYO_FIRST)} ${pick(MAYO_SURNAME)}`;
}

// --------------------------------------------------------------------------
// Heckler Engine — stateful, create one per log stream
// --------------------------------------------------------------------------
export function createHecklerEngine(agentName = "Agent") {
  let heckleCounter = 10; // start high so first heckle fires IMMEDIATELY
  let currentHecklerName = randomMayoName();
  let escalationLevel = 0;
  let agentDisplayName = agentName;

  return {
    setAgentName(name) { agentDisplayName = AGENT_NAMES[name] || name || "Agent"; },
    getAgentName() { return agentDisplayName; },
    getCurrentHeckler() { return currentHecklerName; },

    /** Returns array of heckle event objects, or null if no heckle this time */
    maybeHeckle() {
      heckleCounter++;
      // Heckle every 2-3 messages — the crowd is FERAL
      if (heckleCounter < 2 + Math.floor(Math.random() * 2)) return null;
      heckleCounter = 0;

      const events = [];

      // If heckler exploded last time, bring in a new one
      if (escalationLevel >= 3) {
        const entrance = pick(NEW_HECKLER_ENTRANCES);
        currentHecklerName = randomMayoName();
        escalationLevel = 0;
        events.push({ type: "mayo-entrance", text: entrance });
        events.push({ type: "mayo", name: currentHecklerName, text: "Right so — WHERE WERE WE?? MAYO FOR SAM!!" });
        return events;
      }

      // Normal heckle
      events.push({ type: "mayo", name: currentHecklerName, text: pick(MAYO_HECKLES) });

      // Escalation chance is HIGH and increases fast
      if (Math.random() < 0.6 + escalationLevel * 0.15) {
        // Agent claps back
        events.push({ type: "mayo-comeback", name: agentDisplayName, text: pick(AGENT_COMEBACKS) });

        // Heckler responds based on escalation level
        if (escalationLevel < ESCALATION_RETORTS.length) {
          events.push({ type: "mayo", name: currentHecklerName, text: pick(ESCALATION_RETORTS[escalationLevel]) });

          // Agent gets last word before explosion
          if (escalationLevel === 2) {
            const lastWords = [
              "...right so. Back to the code. WHERE WERE WE. 💻",
              "...I'll dedicate this commit to yer man. Rest in green and red. 🟢🔴",
              "...that's another one this session. They breed them FIERCE in Mayo.",
              "...moment of silence... ... ...RIGHT, back to Sam's PR!!",
            ];
            events.push({ type: "mayo-comeback", name: agentDisplayName, text: pick(lastWords) });
          }
        }
        escalationLevel++;
      }

      return events;
    },

    /** Generate a victory heckle for session complete */
    victoryHeckle() {
      return {
        type: "mayo-explosion",
        text: `🟢🔴 ${currentHecklerName}: MAYO FOR SAM!! The agents are DONE and Sam is COMING WEST!! 🏆 🟢🔴`,
      };
    },
  };
}
