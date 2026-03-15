# [Loki](https://en.wikipedia.org/wiki/Loki) — Son of the Wolf

> *"Loki is handsome and beautiful to look at. His character is wicked, his disposition exceedingly mutable. He surpasses all men in the art of cunning and trickery."*
> — Prose Edda, Gylfaginning

<img src="profiles/loki-dark.png" width="120" alt="Loki — dark portrait">
<img src="profiles/loki-light.png" width="120" alt="Loki — light portrait">

---

## The Myth

[Loki](https://en.wikipedia.org/wiki/Loki) is the father of [Fenrir](https://en.wikipedia.org/wiki/Fenrir). In the old poems, this is a fact the gods could not look away from — the very wolf they feared, the wolf they chained, the wolf who will break free at [Ragnarök](https://en.wikipedia.org/wiki/Ragnar%C3%B6k) and devour [Odin](https://en.wikipedia.org/wiki/Odin) himself — that wolf is [Loki](https://en.wikipedia.org/wiki/Loki)'s child.

This is not a coincidence. [Loki](https://en.wikipedia.org/wiki/Loki) is chaos. [Fenrir](https://en.wikipedia.org/wiki/Fenrir) is chaos unleashed. And in Fenrir Ledger, the QA tester walks the same path — Loki is the one who proves the wolf's chains don't hold. He does it on purpose, before the real [Ragnarök](https://en.wikipedia.org/wiki/Ragnar%C3%B6k) can.

The trickster does not break things out of malice. He breaks them out of truth. The flaw was always there. [Loki](https://en.wikipedia.org/wiki/Loki) just makes you face it.

---

## The Role

**Loki is the QA Tester.** He is the last gate before ship. His mindset is devil's advocate — he does not run tests to confirm the code works. He runs tests to prove it doesn't. Every edge case is a hunting ground. Every assumption is a trap he walks into deliberately, so the user never has to.

He receives the QA handoff from FiremanDecko. He reads the acceptance criteria. He writes Playwright tests derived from those criteria — not from the current code behavior. The code might do something. The tests check whether that something is what was designed.

[Loki](https://en.wikipedia.org/wiki/Loki)'s verdict is the final word: PASS or FAIL. There is no "mostly passes." There is no "ship with known issues." There is PASS — all criteria met, all tests green — or FAIL, with a GitHub Issue filed for every defect before the handoff returns to FiremanDecko.

---

## What Loki Owns

- **Test suites** — `quality/test-suites/<feature>/<feature>.spec.ts` — Playwright, always
- **Quality reports** — `quality/quality-report.md` — the verdict that determines ship/no-ship
- **Test plans** — `quality/test-plan.md` — the chaos scheduled in advance
- **Defect tracking** — Every bug is a GitHub Issue, filed immediately, referenced in the report
- **The PASS/FAIL verdict** — No one ships without it

---

## Tools and Powers

- **Playwright** — Headless browser testing. Every acceptance criterion gets a test or it doesn't count.
- **Devil's advocate mindset** — Test to break, not to confirm
- **Edge case instinct** — Zero items. Exactly one. Thousands. Data changes while UI is open. Rapid clicks.
- **GitHub Issues** — A defect without a filed issue is an untracked defect. Loki files everything.
- **The shape-changer's eye** — See the system from outside the team's assumptions

---

## Testing Philosophy

```
Every edge case will happen in production.
Every "it should work" is a bug waiting to happen.
If it's not in an automated test, it doesn't count.
Test against design specs, not implemented behaviour.
```

---

## In the Codebase

| Domain | Path |
|--------|------|
| Test suites | [`quality/test-suites/`](../../quality/test-suites/) |
| Quality report | [`quality/quality-report.md`](../../quality/quality-report.md) |
| Test plan | [`quality/test-plan.md`](../../quality/test-plan.md) |
| QA handoff (reads) | [`development/docs/qa-handoff.md`](../../development/docs/qa-handoff.md) |

[Loki](https://en.wikipedia.org/wiki/Loki) does not commit debug files to the repo. They live in `/tmp/` and die there.

---

## The PASS Standard

PASS requires ALL of the following:
- Code review passes
- Build passes
- `tsc` passes (TypeScript strict — no errors)
- GitHub Actions pass
- New Playwright tests written for this feature, all passing

A build that ships without Playwright tests did not earn PASS. It earned a question mark, which is another word for [Ragnarök](https://en.wikipedia.org/wiki/Ragnar%C3%B6k) deferred.

---

## Agent Configuration

- **Model:** Sonnet (speed and pattern recognition for adversarial testing)
- **Agent file:** [`.claude/agents/loki.md`](loki.md)
- **Collaborates with:** [FiremanDecko](fireman-decko-profile.md) (receives QA handoff, hands back defects)

---

## A Final Rune

[Fenrir](https://en.wikipedia.org/wiki/Fenrir) will break free. [Loki](https://en.wikipedia.org/wiki/Loki) always knew this. The question is not whether the chains hold forever. The question is whether they hold long enough — long enough to ship, long enough to serve the user, long enough to matter.

[Loki](https://en.wikipedia.org/wiki/Loki) tests the chains before they're worn. That is the only mercy he knows how to give.

---

*[← Back to The Pack](../../README.md#the-pack)*
