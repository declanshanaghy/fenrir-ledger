/**
 * Pack Status Data Layer — Fenrir Ledger
 *
 * First-class TypeScript module that fetches pack status from the GitHub
 * GraphQL and REST APIs. Extracted from pack-status.mjs so both the admin
 * API route and the CLI script can consume the same logic.
 *
 * Uses GITHUB_TOKEN env var for authentication (server-side only).
 *
 * @module admin/pack-status
 */

import { log } from "@/lib/logger";

// ── Constants ─────────────────────────────────────────────────────────────────

const OWNER = "declanshanaghy";
const REPO = "fenrir-ledger";
const PROJECT_NUMBER = 1;

const GH_GQL = "https://api.github.com/graphql";
const GH_API = "https://api.github.com";

// ── Types ─────────────────────────────────────────────────────────────────────

export type IssueType = "bug" | "security" | "ux" | "enhancement" | "research" | "unknown";
export type Priority = "critical" | "high" | "normal" | "low";
export type CIStatus = "pass" | "fail" | "pending" | "unknown";
export type Verdict = "PASS" | "FAIL" | null;
export type NextAction = "merge" | "bounce-back" | "resume" | "wait" | "review" | "done";

export interface ChainAnalysis {
  issue: number;
  title: string;
  type: IssueType;
  priority: Priority;
  chain: string;
  position: string;
  pr: number | null;
  branch: string;
  verdict: Verdict;
  ci: CIStatus | null;
  next_action: NextAction;
  command: string;
}

export interface UpNextItem {
  num: number;
  title: string;
  labels: string[];
  priority: Priority;
  type: IssueType;
  chain: string;
}

export interface VerdictSummary {
  pass: number[];
  fail: number[];
  awaiting_loki: number[];
  awaiting_decko: number[];
  no_response: number[];
  research_review: number[];
}

export interface ActionItem {
  issue: number;
  command: string;
  reason: string;
}

export interface PackStatusResult {
  in_flight: ChainAnalysis[];
  in_flight_count: number;
  up_next_count: number;
  up_next: UpNextItem[];
  open_prs: PullRequest[];
  verdicts: VerdictSummary;
  actions: ActionItem[];
  fetched_at: string;
}

interface ProjectItem {
  num: number;
  title: string;
  labels: string[];
  status: string;
}

interface PullRequest {
  number: number;
  title: string;
  headRefName: string;
  state: string;
}

// ── GraphQL helpers ───────────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN env var is required for pack status");
  }
  return {
    Authorization: `bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "fenrir-admin-pack-status",
    Accept: "application/json",
  };
}

async function graphql(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const headers = getHeaders();
  const res = await fetch(GH_GQL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as {
    errors?: Array<{ message: string }>;
    data?: Record<string, unknown>;
  };

  if (json.errors?.length && !json.data) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json as Record<string, unknown>;
}

async function restGet(path: string): Promise<unknown> {
  const headers = getHeaders();
  const res = await fetch(`${GH_API}${path}`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new Error(`REST request failed: ${res.status} ${res.statusText} — ${path}`);
  }

  return res.json();
}

// ── Data fetching ─────────────────────────────────────────────────────────────

interface BoardData {
  items: ProjectItem[];
  issueComments: Record<number, string[]>;
  pullRequests: PullRequest[];
}

async function fetchBoardAndComments(): Promise<BoardData> {
  const itemsQuery = `
    query($owner: String!, $number: Int!, $cursor: String) {
      user(login: $owner) {
        projectV2(number: $number) {
          items(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
              content {
                ... on Issue {
                  number
                  title
                  state
                  labels(first: 10) {
                    nodes { name }
                  }
                  comments(last: 20) {
                    nodes { body }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const allProjectItems: Array<Record<string, unknown>> = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await graphql(itemsQuery, { owner: OWNER, number: PROJECT_NUMBER, cursor });

    type ProjectV2Items = {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: Array<Record<string, unknown>>;
    };

    const data = result.data as {
      user: { projectV2: { items: ProjectV2Items } };
    };

    const connection = data.user.projectV2.items;

    // Filter out Done items during pagination
    const activeItems = connection.nodes.filter(
      (n: Record<string, unknown>) => {
        const field = n.fieldValueByName as { name?: string } | null;
        return field?.name !== "Done";
      },
    );
    allProjectItems.push(...activeItems);
    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  const prQuery = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        pullRequests(states: OPEN, first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            number
            title
            headRefName
            state
          }
        }
      }
    }
  `;

  const prResult = await graphql(prQuery, { owner: OWNER, repo: REPO });
  const prData = prResult.data as {
    repository: { pullRequests: { nodes: Array<{ number: number; title: string; headRefName: string; state: string }> } };
  };

  const items: ProjectItem[] = [];
  const issueComments: Record<number, string[]> = {};

  for (const item of allProjectItems) {
    type ContentNode = {
      number?: number;
      title?: string;
      labels?: { nodes: Array<{ name: string }> };
      comments?: { nodes: Array<{ body: string }> };
    };

    const content = item.content as ContentNode | null;
    if (!content?.number) continue;

    const field = item.fieldValueByName as { name?: string } | null;
    const status = field?.name ?? "Unknown";
    const labels = (content.labels?.nodes ?? []).map((l) => l.name);

    items.push({
      num: content.number,
      title: content.title ?? "",
      labels,
      status,
    });

    if (content.comments?.nodes) {
      issueComments[content.number] = content.comments.nodes.map((c) => c.body);
    }
  }

  const prs: PullRequest[] = (prData.repository.pullRequests.nodes ?? []).map((pr) => ({
    number: pr.number,
    title: pr.title,
    headRefName: pr.headRefName,
    state: pr.state,
  }));

  return { items, issueComments, pullRequests: prs };
}

async function fetchCIStatus(prs: PullRequest[]): Promise<Record<number, CIStatus>> {
  const ciMap: Record<number, CIStatus> = {};

  await Promise.all(
    prs.map(async (pr) => {
      try {
        const data = (await restGet(
          `/repos/${OWNER}/${REPO}/commits/${pr.headRefName}/check-runs`,
        )) as { check_runs?: Array<{ conclusion: string | null; status: string }> };

        const runs = data.check_runs ?? [];

        if (runs.length === 0) {
          ciMap[pr.number] = "pending";
          return;
        }

        const hasFail = runs.some((r) => r.conclusion === "failure");
        const allComplete = runs.every((r) => r.status === "completed");

        if (hasFail) {
          ciMap[pr.number] = "fail";
        } else if (allComplete) {
          ciMap[pr.number] = "pass";
        } else {
          ciMap[pr.number] = "pending";
        }
      } catch {
        ciMap[pr.number] = "unknown";
      }
    }),
  );

  return ciMap;
}

// ── Analysis helpers ──────────────────────────────────────────────────────────

export function detectType(labels: string[]): IssueType {
  if (labels.includes("bug")) return "bug";
  if (labels.includes("security")) return "security";
  if (labels.includes("ux")) return "ux";
  if (labels.includes("enhancement")) return "enhancement";
  if (labels.includes("research")) return "research";
  return "unknown";
}

export function detectPriority(labels: string[]): Priority {
  if (labels.includes("critical")) return "critical";
  if (labels.includes("high")) return "high";
  if (labels.includes("low")) return "low";
  return "normal";
}

function chainForType(type: IssueType): string {
  switch (type) {
    case "bug":
    case "enhancement":
      return "FiremanDecko → Loki";
    case "ux":
      return "Luna → FiremanDecko → Loki";
    case "security":
      return "Heimdall → Loki";
    case "research":
      return "FiremanDecko (research)";
    default:
      return "unknown";
  }
}

function analyzeChain(
  item: ProjectItem,
  comments: string[],
  prs: PullRequest[],
  ciMap: Record<number, CIStatus>,
): ChainAnalysis {
  const type = detectType(item.labels);
  const priority = detectPriority(item.labels);
  const chain = chainForType(type);

  const matchingPR = prs.find((pr) => pr.headRefName.includes(`issue-${item.num}`));
  const ci: CIStatus | null = matchingPR ? (ciMap[matchingPR.number] ?? null) : null;

  const hasLokiPass = comments.some(
    (c) => c.includes("## Loki QA Verdict") && /Verdict.*PASS/.test(c),
  );
  const hasLokiFail = comments.some(
    (c) => c.includes("## Loki QA Verdict") && /Verdict.*FAIL/.test(c),
  );
  const hasDeckoHandoff = comments.some(
    (c) => c.includes("## FiremanDecko → Loki Handoff"),
  );
  const hasHeimdallHandoff = comments.some(
    (c) => c.includes("## Heimdall → Loki Handoff"),
  );
  const hasLunaHandoff = comments.some(
    (c) => c.includes("## Luna → FiremanDecko Handoff"),
  );
  const hasResearchHandoff = comments.some(
    (c) =>
      c.includes("## Freya Handoff") ||
      (c.includes("## FiremanDecko Handoff") && !c.includes("→ Loki")),
  );

  // Research items with handoff
  if (hasResearchHandoff && type === "research") {
    return {
      issue: item.num,
      title: item.title,
      type,
      priority,
      chain,
      position: "Research complete — awaiting review",
      pr: matchingPR?.number ?? null,
      branch: matchingPR?.headRefName ?? "",
      verdict: null,
      ci,
      next_action: "review",
      command: `/fire-next-up --resume #${item.num}`,
    };
  }

  let position: string;
  let verdict: Verdict = null;
  let next_action: NextAction;
  let command: string;

  if (hasLokiPass) {
    verdict = "PASS";
    if (matchingPR) {
      position = "Loki PASS — ready to merge";
      next_action = "merge";
      command = `gh pr merge ${matchingPR.number} --squash --delete-branch`;
    } else {
      position = "Loki PASS (no open PR)";
      next_action = "done";
      command = "";
    }
  } else if (hasLokiFail) {
    verdict = "FAIL";
    position = "Loki FAIL";
    next_action = "bounce-back";
    command = `/fire-next-up --resume #${item.num}`;
  } else if (hasDeckoHandoff || hasHeimdallHandoff) {
    position = "Awaiting Loki QA";
    next_action = "resume";
    command = `/fire-next-up --resume #${item.num}`;
  } else if (hasLunaHandoff) {
    position = "Awaiting FiremanDecko";
    next_action = "resume";
    command = `/fire-next-up --resume #${item.num}`;
  } else if (matchingPR) {
    position = "Step 1 running or stalled";
    next_action = "wait";
    command = `/fire-next-up --resume #${item.num}`;
  } else {
    position = "Agent dispatched — awaiting PR";
    next_action = "wait";
    command = `/fire-next-up --resume #${item.num}`;
  }

  return {
    issue: item.num,
    title: item.title,
    type,
    priority,
    chain,
    position,
    pr: matchingPR?.number ?? null,
    branch: matchingPR?.headRefName ?? "",
    verdict,
    ci,
    next_action,
    command,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches the full pack status dashboard data.
 *
 * Returns the same JSON structure as `pack-status.mjs --status` but as
 * a typed TypeScript object.
 */
export async function getPackStatus(): Promise<PackStatusResult> {
  log.debug("getPackStatus: fetching board data");

  const { items, issueComments, pullRequests } = await fetchBoardAndComments();
  const ciMap = await fetchCIStatus(pullRequests);

  const inProgress = items.filter((i) => i.status === "In Progress");
  const upNext = items.filter((i) => i.status === "Up Next");

  const chains = inProgress.map((item) =>
    analyzeChain(item, issueComments[item.num] ?? [], pullRequests, ciMap),
  );

  // Sort up-next by priority then type
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  const typeOrder: Record<string, number> = {
    bug: 0,
    security: 1,
    ux: 2,
    enhancement: 3,
    research: 4,
  };

  const sortedUpNext = [...upNext].sort((a, b) => {
    const aPri = Math.min(...a.labels.map((l) => priorityOrder[l] ?? 2));
    const bPri = Math.min(...b.labels.map((l) => priorityOrder[l] ?? 2));
    if (aPri !== bPri) return aPri - bPri;
    const aType = Math.min(...a.labels.map((l) => typeOrder[l] ?? 3));
    const bType = Math.min(...b.labels.map((l) => typeOrder[l] ?? 3));
    if (aType !== bType) return aType - bType;
    return a.num - b.num;
  });

  const upNextItems: UpNextItem[] = sortedUpNext.map((item) => ({
    num: item.num,
    title: item.title,
    labels: item.labels,
    priority: detectPriority(item.labels),
    type: detectType(item.labels),
    chain: chainForType(detectType(item.labels)),
  }));

  const result: PackStatusResult = {
    in_flight: chains,
    in_flight_count: chains.length,
    up_next_count: upNextItems.length,
    up_next: upNextItems,
    open_prs: pullRequests,
    verdicts: {
      pass: chains.filter((c) => c.verdict === "PASS").map((c) => c.issue),
      fail: chains.filter((c) => c.verdict === "FAIL").map((c) => c.issue),
      awaiting_loki: chains
        .filter((c) => c.position.includes("Awaiting Loki"))
        .map((c) => c.issue),
      awaiting_decko: chains
        .filter((c) => c.position.includes("Awaiting FiremanDecko"))
        .map((c) => c.issue),
      no_response: chains
        .filter(
          (c) =>
            c.position.includes("awaiting PR") || c.position.includes("running"),
        )
        .map((c) => c.issue),
      research_review: chains
        .filter((c) => c.next_action === "review")
        .map((c) => c.issue),
    },
    actions: chains.map((c) => ({
      issue: c.issue,
      command: c.command,
      reason: c.position,
    })),
    fetched_at: new Date().toISOString(),
  };

  log.debug("getPackStatus: complete", {
    inFlightCount: result.in_flight_count,
    upNextCount: result.up_next_count,
  });

  return result;
}
