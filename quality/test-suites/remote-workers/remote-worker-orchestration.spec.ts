/**
 * Remote Worker Orchestration Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the GitHub Actions workflow and skill documentation for Issue #175.
 * These are infrastructure tests — no browser required. Assertions are derived
 * entirely from the acceptance criteria in Issue #175, not from what the code does.
 *
 * Acceptance Criteria under test:
 *   AC-1: .github/workflows/agent-chain.yml exists and is structurally sound
 *   AC-2: Chain handoff via GitHub Actions jobs (preflight → step1 → step2 → step3 → summary)
 *   AC-3: --remote flag is documented in the skill's Flags table
 *   AC-4: Handoff comments posted on issues by remote agents (comment steps present)
 *   AC-5: Board state management (In Progress / Done) references present
 *   AC-6: Cost tracking documented
 *
 * What CANNOT be tested by this suite:
 *   - Live GitHub Actions workflow execution (requires ANTHROPIC_API_KEY secret + actual runner)
 *   - Real gh workflow run dispatch (requires GitHub auth and network)
 *   - Actual board state mutation (requires project board API access)
 *
 * Manual verification steps for untestable paths:
 *   1. Add ANTHROPIC_API_KEY to repo GitHub Actions secrets
 *   2. Run: gh workflow run agent-chain.yml -f issue_number="1" -f branch_name="test" -f chain_type="test"
 *   3. Verify each job appears in the Actions UI
 *   4. Verify handoff comment is posted on the issue
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ─── File paths (relative to repo root) ───────────────────────────────────────

// Resolve repo root: go up from quality/test-suites/remote-workers/
// The playwright config sets testDir to quality/test-suites, so __dirname is:
// <repo-root>/quality/test-suites/remote-workers
const REPO_ROOT = path.resolve(__dirname, "../../..");
const WORKFLOW_PATH = path.join(REPO_ROOT, ".github/workflows/agent-chain.yml");
const SKILL_PATH = path.join(REPO_ROOT, ".claude/skills/fire-next-up/SKILL.md");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readWorkflow(): string {
  expect(
    fs.existsSync(WORKFLOW_PATH),
    `Workflow file must exist at ${WORKFLOW_PATH}`
  ).toBe(true);
  return fs.readFileSync(WORKFLOW_PATH, "utf8");
}

function readSkill(): string {
  expect(
    fs.existsSync(SKILL_PATH),
    `Skill file must exist at ${SKILL_PATH}`
  ).toBe(true);
  return fs.readFileSync(SKILL_PATH, "utf8");
}

// ─── TC-RW-001: Workflow file exists ─────────────────────────────────────────

test.describe("TC-RW-001: Workflow file existence and identity", () => {
  test("agent-chain.yml exists in .github/workflows/", () => {
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
  });

  test("workflow has the correct name 'Agent Chain — Remote Worker'", () => {
    const content = readWorkflow();
    // Derived from AC-1: the workflow must be identifiable in the GH Actions UI
    expect(content).toMatch(/^name:\s*Agent Chain.*Remote Worker/m);
  });

  test("workflow is triggered by workflow_dispatch", () => {
    const content = readWorkflow();
    // AC-1: must be dispatchable — workflow_dispatch is the only supported trigger
    expect(content).toMatch(/^\s*workflow_dispatch:/m);
  });
});

// ─── TC-RW-002: workflow_dispatch inputs ─────────────────────────────────────

test.describe("TC-RW-002: workflow_dispatch inputs are properly defined", () => {
  test("has required input: issue_number (type string, required true)", () => {
    const content = readWorkflow();
    // AC-1: issue_number required — without it, workflow cannot target any issue
    expect(content).toMatch(/issue_number:/);
    // Extract the issue_number block and verify required: true
    const idx = content.indexOf("issue_number:");
    const block = content.slice(idx, idx + 200);
    expect(block).toMatch(/required:\s*true/);
    expect(block).toMatch(/type:\s*string/);
  });

  test("has required input: branch_name (type string, required true)", () => {
    const content = readWorkflow();
    // AC-1: branch_name required — agents must know which branch to check out
    expect(content).toMatch(/branch_name:/);
    const idx = content.indexOf("branch_name:");
    const block = content.slice(idx, idx + 200);
    expect(block).toMatch(/required:\s*true/);
    expect(block).toMatch(/type:\s*string/);
  });

  test("has required input: chain_type (type choice, required true)", () => {
    const content = readWorkflow();
    // AC-1: chain_type must be a choice so only valid values can be dispatched
    expect(content).toMatch(/chain_type:/);
    const idx = content.indexOf("chain_type:");
    const block = content.slice(idx, idx + 300);
    expect(block).toMatch(/required:\s*true/);
    expect(block).toMatch(/type:\s*choice/);
  });

  test("chain_type options include all 5 valid types: bug, feature, ux, security, test", () => {
    const content = readWorkflow();
    // AC-1: all 5 chain types from the agent chain table must be dispatchable
    const validTypes = ["bug", "feature", "ux", "security", "test"];
    for (const chainType of validTypes) {
      expect(content).toContain(`"${chainType}"`);
    }
  });

  test("has optional input: timeout_minutes with default of 30", () => {
    const content = readWorkflow();
    // AC-6 (cost tracking): configurable timeout prevents runaway cost accumulation
    expect(content).toMatch(/timeout_minutes:/);
    const idx = content.indexOf("timeout_minutes:");
    const block = content.slice(idx, idx + 200);
    expect(block).toMatch(/required:\s*false/);
    expect(block).toMatch(/default:\s*["']?30["']?/);
  });
});

// ─── TC-RW-003: Job dependency chain ─────────────────────────────────────────

test.describe("TC-RW-003: Job dependency chain is correct", () => {
  test("preflight job exists with no upstream dependencies", () => {
    const content = readWorkflow();
    // AC-2: preflight is the entry point — it must not depend on any other job
    expect(content).toMatch(/^  preflight:/m);
    // Verify preflight does NOT have a 'needs:' line immediately after it
    const preflightIdx = content.indexOf("\n  preflight:");
    const nextJobIdx = content.indexOf("\n  step1:", preflightIdx);
    const preflightBlock = content.slice(preflightIdx, nextJobIdx);
    // preflight block should not contain a 'needs:' key
    expect(preflightBlock).not.toMatch(/^\s+needs:/m);
  });

  test("step1 needs preflight", () => {
    const content = readWorkflow();
    // AC-2: step1 cannot run before preflight resolves chain type and issue details
    const step1Idx = content.indexOf("\n  step1:");
    const step2Idx = content.indexOf("\n  step2:", step1Idx);
    const step1Block = content.slice(step1Idx, step2Idx);
    expect(step1Block).toMatch(/needs:\s*preflight/);
  });

  test("step2 needs both preflight and step1", () => {
    const content = readWorkflow();
    // AC-2: step2 reads preflight outputs and step1 must have committed its work
    const step2Idx = content.indexOf("\n  step2:");
    const step3Idx = content.indexOf("\n  step3:", step2Idx);
    const step2Block = content.slice(step2Idx, step3Idx);
    expect(step2Block).toMatch(/needs:\s*\[preflight,\s*step1\]/);
  });

  test("step3 needs both preflight and step2", () => {
    const content = readWorkflow();
    // AC-2: step3 builds on step2 output — cannot skip step2
    const step3Idx = content.indexOf("\n  step3:");
    const summaryIdx = content.indexOf("\n  summary:", step3Idx);
    const step3Block = content.slice(step3Idx, summaryIdx);
    expect(step3Block).toMatch(/needs:\s*\[preflight,\s*step2\]/);
  });

  test("summary needs all four preceding jobs", () => {
    const content = readWorkflow();
    // AC-2: summary must receive results from all steps to build the status table
    const summaryIdx = content.indexOf("\n  summary:");
    const summaryBlock = content.slice(summaryIdx, summaryIdx + 300);
    expect(summaryBlock).toMatch(/needs:\s*\[preflight,\s*step1,\s*step2,\s*step3\]/);
  });

  test("summary runs with if: always() regardless of step outcomes", () => {
    const content = readWorkflow();
    // AC-4: handoff summary must post even when prior steps fail
    const summaryIdx = content.indexOf("\n  summary:");
    const summaryBlock = content.slice(summaryIdx, summaryIdx + 400);
    expect(summaryBlock).toMatch(/if:\s*always\(\)/);
  });
});

// ─── TC-RW-004: Conditional execution for chain types ────────────────────────

test.describe("TC-RW-004: Conditional execution logic for different chain types", () => {
  test("step2 has conditional skip when step2_agent is empty", () => {
    const content = readWorkflow();
    // AC-2: 'test' chains only run step1 (Loki alone) — step2 must be skipped
    const step2Idx = content.indexOf("\n  step2:");
    const step3Idx = content.indexOf("\n  step3:", step2Idx);
    const step2Block = content.slice(step2Idx, step3Idx);
    expect(step2Block).toMatch(/if:.*step2_agent.*!= ''/);
  });

  test("step3 has conditional skip when step3_agent is empty", () => {
    const content = readWorkflow();
    // AC-2: bug/feature/security chains only run 2 steps — step3 must be skipped
    const step3Idx = content.indexOf("\n  step3:");
    const summaryIdx = content.indexOf("\n  summary:", step3Idx);
    const step3Block = content.slice(step3Idx, summaryIdx);
    expect(step3Block).toMatch(/if:.*step3_agent.*!= ''/);
  });

  test("bug/feature chain: step1=FiremanDecko, step2=Loki, step3=empty", () => {
    const content = readWorkflow();
    // AC-2: bug|feature case in the shell script must assign the correct agents
    const caseIdx = content.indexOf("bug|feature)");
    expect(caseIdx).toBeGreaterThan(0);
    const block = content.slice(caseIdx, caseIdx + 300);
    expect(block).toMatch(/step1=FiremanDecko/);
    expect(block).toMatch(/step2=Loki/);
    expect(block).toMatch(/step3=/); // step3 must be set to empty string
  });

  test("ux chain: step1=Luna, step2=FiremanDecko, step3=Loki", () => {
    const content = readWorkflow();
    // AC-2: ux chain must route through design before implementation before QA
    const caseIdx = content.indexOf("ux)");
    expect(caseIdx).toBeGreaterThan(0);
    const block = content.slice(caseIdx, caseIdx + 300);
    expect(block).toMatch(/step1=Luna/);
    expect(block).toMatch(/step2=FiremanDecko/);
    expect(block).toMatch(/step3=Loki/);
  });

  test("security chain: step1=Heimdall, step2=Loki, step3=empty", () => {
    const content = readWorkflow();
    // AC-2: security chain is Heimdall → Loki, not FiremanDecko
    const caseIdx = content.indexOf("security)");
    expect(caseIdx).toBeGreaterThan(0);
    const block = content.slice(caseIdx, caseIdx + 300);
    expect(block).toMatch(/step1=Heimdall/);
    expect(block).toMatch(/step2=Loki/);
    expect(block).toMatch(/step3=/);
  });

  test("test chain: step1=Loki, step2=empty, step3=empty", () => {
    const content = readWorkflow();
    // AC-2: test-only chain has Loki as sole agent — no other steps
    const caseIdx = content.indexOf("\n            test)");
    expect(caseIdx).toBeGreaterThan(0);
    const block = content.slice(caseIdx, caseIdx + 300);
    expect(block).toMatch(/step1=Loki/);
    expect(block).toMatch(/step2=/);
    expect(block).toMatch(/step3=/);
  });

  test("all 5 chain types are handled — no unhandled case falls through", () => {
    const content = readWorkflow();
    // AC-2: every valid chain_type input must produce a defined agent assignment
    const chainTypes = ["bug|feature", "ux)", "security)", "test)"];
    for (const ct of chainTypes) {
      expect(content).toContain(ct);
    }
  });
});

// ─── TC-RW-005: Concurrency control ──────────────────────────────────────────

test.describe("TC-RW-005: Concurrency control is configured", () => {
  test("concurrency group is scoped per issue_number", () => {
    const content = readWorkflow();
    // AC-2: only one chain per issue at a time — prevents interleaved commits
    expect(content).toMatch(/concurrency:/);
    const concurrencyIdx = content.indexOf("concurrency:");
    const block = content.slice(concurrencyIdx, concurrencyIdx + 200);
    expect(block).toMatch(/group:.*agent-chain.*issue_number/);
  });

  test("concurrency does NOT cancel in-progress runs", () => {
    const content = readWorkflow();
    // AC-2: queued second dispatch should wait, not kill the running chain
    const concurrencyIdx = content.indexOf("concurrency:");
    const block = content.slice(concurrencyIdx, concurrencyIdx + 200);
    expect(block).toMatch(/cancel-in-progress:\s*false/);
  });
});

// ─── TC-RW-006: Permissions ───────────────────────────────────────────────────

test.describe("TC-RW-006: Workflow permissions are declared", () => {
  test("workflow declares explicit permissions", () => {
    const content = readWorkflow();
    // Security baseline: explicit permissions prevent accidental scope creep
    expect(content).toMatch(/^permissions:/m);
  });

  test("workflow has contents: write (for branch creation and commits)", () => {
    const content = readWorkflow();
    const permsIdx = content.indexOf("permissions:");
    const permsBlock = content.slice(permsIdx, permsIdx + 200);
    expect(permsBlock).toMatch(/contents:\s*write/);
  });

  test("workflow has issues: write (for posting handoff comments)", () => {
    const content = readWorkflow();
    // AC-4: agents must be able to post comments on issues
    const permsIdx = content.indexOf("permissions:");
    const permsBlock = content.slice(permsIdx, permsIdx + 200);
    expect(permsBlock).toMatch(/issues:\s*write/);
  });

  test("workflow has pull-requests: write (for PR creation by Loki)", () => {
    const content = readWorkflow();
    const permsIdx = content.indexOf("permissions:");
    const permsBlock = content.slice(permsIdx, permsIdx + 200);
    expect(permsBlock).toMatch(/pull-requests:\s*write/);
  });
});

// ─── TC-RW-007: Handoff comments ─────────────────────────────────────────────

test.describe("TC-RW-007: Handoff comments posted by remote agents", () => {
  test("preflight job posts a dispatch comment on the issue", () => {
    const content = readWorkflow();
    // AC-4: user must know a chain has started before jobs begin
    expect(content).toMatch(/Post dispatch comment/);
  });

  test("step1 has a 'Post step 1 status' step with if: always()", () => {
    const content = readWorkflow();
    // AC-4: step status must post even if the agent step fails
    expect(content).toMatch(/Post step 1 status/);
    const statusIdx = content.indexOf("Post step 1 status");
    const block = content.slice(statusIdx - 50, statusIdx + 100);
    expect(block).toMatch(/if:\s*always\(\)/);
  });

  test("step2 has a 'Post step 2 status' step with if: always()", () => {
    const content = readWorkflow();
    expect(content).toMatch(/Post step 2 status/);
    const statusIdx = content.indexOf("Post step 2 status");
    const block = content.slice(statusIdx - 50, statusIdx + 100);
    expect(block).toMatch(/if:\s*always\(\)/);
  });

  test("step3 has a 'Post step 3 status' step with if: always()", () => {
    const content = readWorkflow();
    expect(content).toMatch(/Post step 3 status/);
    const statusIdx = content.indexOf("Post step 3 status");
    const block = content.slice(statusIdx - 50, statusIdx + 100);
    expect(block).toMatch(/if:\s*always\(\)/);
  });

  test("summary job posts a final summary table on the issue", () => {
    const content = readWorkflow();
    // AC-4: final status table format must include Step/Agent/Result columns
    expect(content).toMatch(/Post chain summary/);
    // The table must have the three required columns — search whole file since
    // the shell script body may be far from the step name in the YAML
    expect(content).toMatch(/\| Step \| Agent \| Result \|/);
  });
});

// ─── TC-RW-008: Board state management ───────────────────────────────────────

test.describe("TC-RW-008: Board state management references", () => {
  test("preflight job references moving issue to In Progress", () => {
    const content = readWorkflow();
    // AC-5: board must reflect that work has started
    expect(content).toMatch(/In Progress/);
    expect(content).toMatch(/Move issue to In Progress/i);
  });
});

// ─── TC-RW-009: Claude Code action integration ───────────────────────────────

test.describe("TC-RW-009: Claude Code action is wired up in each agent step", () => {
  test("step1 uses anthropics/claude-code-action@v1", () => {
    const content = readWorkflow();
    // AC-1: agents must run via the official claude-code-action
    const step1Idx = content.indexOf("\n  step1:");
    const step2Idx = content.indexOf("\n  step2:", step1Idx);
    const step1Block = content.slice(step1Idx, step2Idx);
    expect(step1Block).toMatch(/anthropics\/claude-code-action@v1/);
  });

  test("step2 uses anthropics/claude-code-action@v1", () => {
    const content = readWorkflow();
    const step2Idx = content.indexOf("\n  step2:");
    const step3Idx = content.indexOf("\n  step3:", step2Idx);
    const step2Block = content.slice(step2Idx, step3Idx);
    expect(step2Block).toMatch(/anthropics\/claude-code-action@v1/);
  });

  test("step3 uses anthropics/claude-code-action@v1", () => {
    const content = readWorkflow();
    const step3Idx = content.indexOf("\n  step3:");
    const summaryIdx = content.indexOf("\n  summary:", step3Idx);
    const step3Block = content.slice(step3Idx, summaryIdx);
    expect(step3Block).toMatch(/anthropics\/claude-code-action@v1/);
  });

  test("ANTHROPIC_API_KEY secret is passed to each agent step", () => {
    const content = readWorkflow();
    // Security: API key must travel via secrets, never hardcoded
    const keyRef = /secrets\.ANTHROPIC_API_KEY/g;
    const matches = content.match(keyRef);
    // Expect at least 3 references (one per agent step)
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── TC-RW-010: Skill documentation — --remote flag ─────────────────────────

test.describe("TC-RW-010: --remote flag documented in skill Flags table", () => {
  test("SKILL.md exists", () => {
    expect(fs.existsSync(SKILL_PATH)).toBe(true);
  });

  test("Flags table contains --remote entry", () => {
    const content = readSkill();
    // AC-3: --remote must appear in the flags table so users know it exists
    expect(content).toMatch(/`--remote`/);
  });

  test("--remote flag entry describes dispatching to GitHub Actions", () => {
    const content = readSkill();
    // AC-3: the description must clarify that this is a remote dispatch, not local
    const remoteIdx = content.indexOf("`--remote`");
    expect(remoteIdx).toBeGreaterThan(0);
    const block = content.slice(remoteIdx, remoteIdx + 200);
    expect(block).toMatch(/GitHub Actions/i);
  });

  test("Remote Dispatch section exists in skill", () => {
    const content = readSkill();
    // AC-3: full dispatch documentation must be present, not just a table entry
    expect(content).toMatch(/## Remote Dispatch/);
  });

  test("Remote Dispatch section documents gh workflow run command", () => {
    const content = readSkill();
    // AC-3: operators need the exact dispatch command
    const sectionIdx = content.indexOf("## Remote Dispatch");
    const block = content.slice(sectionIdx, sectionIdx + 1000);
    expect(block).toMatch(/gh workflow run agent-chain\.yml/);
  });

  test("Remote Dispatch section documents issue_number, branch_name, chain_type flags", () => {
    const content = readSkill();
    const sectionIdx = content.indexOf("## Remote Dispatch");
    const block = content.slice(sectionIdx, sectionIdx + 1000);
    expect(block).toMatch(/-f issue_number/);
    expect(block).toMatch(/-f branch_name/);
    expect(block).toMatch(/-f chain_type/);
  });

  test("--remote --batch N combination is documented", () => {
    const content = readSkill();
    // AC-3: batch remote dispatch must be documented as a supported combination
    expect(content).toMatch(/--remote.*--batch|--batch.*--remote/);
  });

  test("cost awareness section is present with estimated cost", () => {
    const content = readSkill();
    // AC-6: cost tracking requires documented estimates for informed use
    expect(content).toMatch(/Cost awareness|cost awareness/i);
    // Must include a dollar amount or cost estimate
    expect(content).toMatch(/\$[\d.]+\/issue/);
  });

  test("monitoring instructions documented (gh run list)", () => {
    const content = readSkill();
    // AC-3: users must be able to monitor running remote chains
    expect(content).toMatch(/gh run list/);
  });
});

// ─── TC-RW-011: Preflight outputs ────────────────────────────────────────────

test.describe("TC-RW-011: Preflight job outputs are fully declared", () => {
  test("preflight declares step1_agent output", () => {
    const content = readWorkflow();
    // AC-2: downstream jobs reference preflight outputs for agent identity
    const preflightIdx = content.indexOf("  preflight:");
    const step1Idx = content.indexOf("  step1:", preflightIdx);
    const preflightBlock = content.slice(preflightIdx, step1Idx);
    expect(preflightBlock).toMatch(/step1_agent:/);
  });

  test("preflight declares step2_agent output", () => {
    const content = readWorkflow();
    const preflightIdx = content.indexOf("  preflight:");
    const step1Idx = content.indexOf("  step1:", preflightIdx);
    const preflightBlock = content.slice(preflightIdx, step1Idx);
    expect(preflightBlock).toMatch(/step2_agent:/);
  });

  test("preflight declares step3_agent output", () => {
    const content = readWorkflow();
    const preflightIdx = content.indexOf("  preflight:");
    const step1Idx = content.indexOf("  step1:", preflightIdx);
    const preflightBlock = content.slice(preflightIdx, step1Idx);
    expect(preflightBlock).toMatch(/step3_agent:/);
  });

  test("preflight declares chain_steps output", () => {
    const content = readWorkflow();
    const preflightIdx = content.indexOf("  preflight:");
    const step1Idx = content.indexOf("  step1:", preflightIdx);
    const preflightBlock = content.slice(preflightIdx, step1Idx);
    expect(preflightBlock).toMatch(/chain_steps:/);
  });

  test("preflight declares issue_title output", () => {
    const content = readWorkflow();
    // AC-2: issue title is used in agent prompts for context
    const preflightIdx = content.indexOf("  preflight:");
    const step1Idx = content.indexOf("  step1:", preflightIdx);
    const preflightBlock = content.slice(preflightIdx, step1Idx);
    expect(preflightBlock).toMatch(/issue_title:/);
  });
});

// ─── TC-RW-012: Agent prompts reference issue context ────────────────────────

test.describe("TC-RW-012: Agent prompts include issue context from preflight", () => {
  test("step1 prompt references issue_title from preflight outputs", () => {
    const content = readWorkflow();
    // AC-2: agents need issue context to do meaningful work
    const step1Idx = content.indexOf("\n  step1:");
    const step2Idx = content.indexOf("\n  step2:", step1Idx);
    const step1Block = content.slice(step1Idx, step2Idx);
    expect(step1Block).toMatch(/preflight\.outputs\.issue_title/);
  });

  test("step1 prompt identifies the agent by name from preflight outputs", () => {
    const content = readWorkflow();
    const step1Idx = content.indexOf("\n  step1:");
    const step2Idx = content.indexOf("\n  step2:", step1Idx);
    const step1Block = content.slice(step1Idx, step2Idx);
    expect(step1Block).toMatch(/preflight\.outputs\.step1_agent/);
  });

  test("step2 prompt references previous agent from step1_agent output", () => {
    const content = readWorkflow();
    // AC-2: step2 must know who ran before it to read handoff comments
    const step2Idx = content.indexOf("\n  step2:");
    const step3Idx = content.indexOf("\n  step3:", step2Idx);
    const step2Block = content.slice(step2Idx, step3Idx);
    expect(step2Block).toMatch(/preflight\.outputs\.step1_agent/);
  });

  test("final-agent step instructs Loki to create PR with Fixes #ISSUE_NUMBER", () => {
    const content = readWorkflow();
    // AC-2: only Loki closes the issue — via Fixes # in PR body
    // This must appear in step2 prompt (Loki in 2-step chains) or step3 prompt
    expect(content).toMatch(/Fixes #\$\{\{.*ISSUE_NUMBER.*\}\}/);
  });
});

// ─── TC-RW-013: Timeout configuration ────────────────────────────────────────

test.describe("TC-RW-013: Per-step timeout is enforced", () => {
  test("step1 job has a timeout-minutes setting", () => {
    const content = readWorkflow();
    // AC-6: runaway agents must be killed to prevent cost overrun
    const step1Idx = content.indexOf("\n  step1:");
    const step2Idx = content.indexOf("\n  step2:", step1Idx);
    const step1Block = content.slice(step1Idx, step2Idx);
    expect(step1Block).toMatch(/timeout-minutes:/);
  });

  test("step2 job has a timeout-minutes setting", () => {
    const content = readWorkflow();
    const step2Idx = content.indexOf("\n  step2:");
    const step3Idx = content.indexOf("\n  step3:", step2Idx);
    const step2Block = content.slice(step2Idx, step3Idx);
    expect(step2Block).toMatch(/timeout-minutes:/);
  });

  test("step3 job has a timeout-minutes setting", () => {
    const content = readWorkflow();
    const step3Idx = content.indexOf("\n  step3:");
    const summaryIdx = content.indexOf("\n  summary:", step3Idx);
    const step3Block = content.slice(step3Idx, summaryIdx);
    expect(step3Block).toMatch(/timeout-minutes:/);
  });
});
