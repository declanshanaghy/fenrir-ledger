#!/usr/bin/env -S npx tsx
/**
 * pack-status.ts — Full pack status dashboard via GraphQL
 *
 * Usage: npx tsx pack-status.ts [--status] [--chain-status <N>] [--move <N> <up-next|in-progress|done>]
 *
 * Uses native fetch + GitHub GraphQL API directly (no child process spawning).
 * Auth token obtained from `gh auth token` once at startup.
 */
import { execSync } from "child_process";

const OWNER = "declanshanaghy";
const REPO = "fenrir-ledger";
const PROJECT_NUMBER = 1;
const PROJECT_ID = "PVT_kwHOAAW5PM4BQ7LP";
const FIELD_ID = "PVTSSF_lAHOAAW5PM4BQ7LPzg-54RA";
const STATUS_OPTIONS: Record<string, string> = {
  "up-next": "6e492bcc",
  "in-progress": "1d9139d4",
  done: "c5fe053a",
};

const GH_API = "https://api.github.com";
const GH_GQL = "https://api.github.com/graphql";

// Get token once at startup (only execSync we keep)
const TOKEN = execSync("gh auth token", { encoding: "utf-8" }).trim();

const HEADERS = {
  Authorization: `bearer ${TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "fenrir-pack-status",
  Accept: "application/json",
};

// --- Helpers ---

async function graphql(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<any> {
  const res = await fetch(GH_GQL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (json.errors?.length && !json.data) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json;
}

async function restGet(path: string): Promise<any> {
  const res = await fetch(`${GH_API}${path}`, {
    method: "GET",
    headers: HEADERS,
  });
  if (!res.ok) {
    throw new Error(`REST request failed: ${res.status} ${res.statusText} — ${path}`);
  }
  return res.json();
}

// --- Types ---

interface ChainStatus {
  issue: number;
  title: string;
  type: string;
  priority: string;
  chain: string;
  position: string;
  pr: number | null;
  branch: string;
  verdict: string | null;
  ci: string | null;
  next_action: string;
  command: string;
}

interface BoardItem {
  num: number;
  title: string;
  labels: string[];
  status: string;
}

// --- Board Fetch (single GraphQL query for ALL project items + comments) ---

async function fetchBoardAndComments(): Promise<{
  items: BoardItem[];
  issueComments: Record<number, string[]>;
  pullRequests: Array<{
    number: number;
    title: string;
    headRefName: string;
    state: string;
  }>;
}> {
  // Paginated query — board may exceed 100 items
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

  // Fetch all project items with pagination
  let allProjectItems: any[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const result = await graphql(itemsQuery, { owner: OWNER, number: PROJECT_NUMBER, cursor });
    const connection = result.data.user.projectV2.items;
    allProjectItems.push(...connection.nodes);
    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  // Separate query for PRs (no pagination needed — 50 open PRs is unlikely)
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

  const projectItems = allProjectItems;
  const items: BoardItem[] = [];
  const issueComments: Record<number, string[]> = {};

  for (const item of projectItems) {
    if (!item.content?.number) continue;
    const status = item.fieldValueByName?.name ?? "Unknown";
    const labels = (item.content.labels?.nodes ?? []).map((l: any) => l.name);

    items.push({
      num: item.content.number,
      title: item.content.title,
      labels,
      status,
    });

    if (item.content.comments?.nodes) {
      issueComments[item.content.number] = item.content.comments.nodes.map(
        (c: any) => c.body
      );
    }
  }

  const prs = (prResult.data.repository.pullRequests.nodes ?? []).map(
    (pr: any) => ({
      number: pr.number,
      title: pr.title,
      headRefName: pr.headRefName,
      state: pr.state,
    })
  );

  return { items, issueComments, pullRequests: prs };
}

// --- Chain Status Detection ---

function detectType(labels: string[]): string {
  if (labels.includes("bug")) return "bug";
  if (labels.includes("security")) return "security";
  if (labels.includes("ux")) return "ux";
  if (labels.includes("enhancement")) return "enhancement";
  if (labels.includes("research")) return "research";
  return "unknown";
}

function detectPriority(labels: string[]): string {
  if (labels.includes("critical")) return "critical";
  if (labels.includes("high")) return "high";
  if (labels.includes("low")) return "low";
  return "normal";
}

function chainForType(type: string): string {
  switch (type) {
    case "bug":
    case "enhancement":
      return "FiremanDecko \u2192 Loki";
    case "ux":
      return "Luna \u2192 FiremanDecko \u2192 Loki";
    case "security":
      return "Heimdall \u2192 Loki";
    case "research":
      return "FiremanDecko (research)";
    default:
      return "unknown";
  }
}

function analyzeChain(
  item: BoardItem,
  comments: string[],
  prs: Array<{ number: number; headRefName: string }>
): ChainStatus {
  const type = detectType(item.labels);
  const priority = detectPriority(item.labels);
  const chain = chainForType(type);

  const matchingPR = prs.find((pr) =>
    pr.headRefName.includes(`issue-${item.num}`)
  );

  const hasLokiPass = comments.some(
    (c) => c.includes("## Loki QA Verdict") && /Verdict.*PASS/.test(c)
  );
  const hasLokiFail = comments.some(
    (c) => c.includes("## Loki QA Verdict") && /Verdict.*FAIL/.test(c)
  );
  const hasDeckoHandoff = comments.some((c) =>
    c.includes("## FiremanDecko \u2192 Loki Handoff")
  );
  const hasHeimdallHandoff = comments.some((c) =>
    c.includes("## Heimdall \u2192 Loki Handoff")
  );
  const hasLunaHandoff = comments.some((c) =>
    c.includes("## Luna \u2192 FiremanDecko Handoff")
  );
  // Research handoffs: "## Freya Handoff" or "## FiremanDecko Handoff" (without → Loki)
  const hasResearchHandoff = comments.some(
    (c) =>
      (c.includes("## Freya Handoff") ||
        (c.includes("## FiremanDecko Handoff") &&
          !c.includes("\u2192 Loki")))
  );

  let position: string;
  let verdict: string | null = null;
  let next_action: string;
  let command: string;

  // Research chains: agent posted handoff, no Loki step
  if (hasResearchHandoff && type === "research") {
    position = "Research complete \u2014 awaiting review";
    next_action = "review";
    command = `/fire-next-up --resume #${item.num}`;
    return {
      issue: item.num,
      title: item.title,
      type,
      priority,
      chain,
      position,
      pr: matchingPR?.number ?? null,
      branch: matchingPR?.headRefName ?? "",
      verdict: null,
      ci: null,
      next_action,
      command,
    };
  }

  if (hasLokiPass) {
    verdict = "PASS";
    if (matchingPR) {
      position = "Loki PASS \u2014 ready to merge";
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
    position = "No PR \u2014 agent may have failed";
    next_action = "re-dispatch";
    command = `/fire-next-up #${item.num} --local`;
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
    ci: null,
    next_action,
    command,
  };
}

// --- Commands ---

async function statusDashboard() {
  const { items, issueComments, pullRequests } = await fetchBoardAndComments();

  const inProgress = items.filter((i) => i.status === "In Progress");
  const upNext = items.filter((i) => i.status === "Up Next");

  const chains: ChainStatus[] = inProgress.map((item) =>
    analyzeChain(item, issueComments[item.num] ?? [], pullRequests)
  );

  const result = {
    in_flight: chains,
    in_flight_count: chains.length,
    up_next_count: upNext.length,
    up_next_top3: upNext.slice(0, 3).map((i) => ({
      num: i.num,
      title: i.title,
      labels: i.labels,
    })),
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
          (c) => c.position.includes("No PR") || c.position.includes("running")
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
  };

  console.log(JSON.stringify(result, null, 2));
}

async function chainStatus(issueNum: number) {
  const { items, issueComments, pullRequests } = await fetchBoardAndComments();
  const item = items.find((i) => i.num === issueNum);
  if (!item) {
    console.error(`Issue #${issueNum} not found on project board`);
    process.exit(1);
  }
  const status = analyzeChain(
    item,
    issueComments[issueNum] ?? [],
    pullRequests
  );
  console.log(JSON.stringify(status, null, 2));
}

async function moveIssue(issueNum: number, status: string) {
  const optionId = STATUS_OPTIONS[status];
  if (!optionId) {
    console.error(`Invalid status: ${status} (use up-next, in-progress, done)`);
    process.exit(1);
  }

  // Find item ID via paginated GraphQL
  const findQuery = `
    query($owner: String!, $number: Int!, $cursor: String) {
      user(login: $owner) {
        projectV2(number: $number) {
          items(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              content { ... on Issue { number } }
            }
          }
        }
      }
    }
  `;
  let node: any = null;
  let findCursor: string | null = null;
  let findHasNext = true;
  while (findHasNext && !node) {
    const findResult = await graphql(findQuery, {
      owner: OWNER,
      number: PROJECT_NUMBER,
      cursor: findCursor,
    });
    const connection = findResult.data.user.projectV2.items;
    node = connection.nodes.find(
      (n: any) => n.content?.number === issueNum
    );
    findHasNext = connection.pageInfo.hasNextPage;
    findCursor = connection.pageInfo.endCursor;
  }
  if (!node) {
    console.error(`Issue #${issueNum} not found on project board`);
    process.exit(1);
  }

  // Mutate via GraphQL (replaces `gh project item-edit`)
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }
  `;
  await graphql(mutation, {
    projectId: PROJECT_ID,
    itemId: node.id,
    fieldId: FIELD_ID,
    optionId: optionId,
  });

  console.log(`Moved #${issueNum} to ${status}`);
}

// --- Resume Detection ---

async function resumeDetect(issueNum: number) {
  // Fire all requests concurrently
  const [boardData, issueJSON, refsData] = await Promise.all([
    fetchBoardAndComments(),
    restGet(`/repos/${OWNER}/${REPO}/issues/${issueNum}`),
    restGet(`/repos/${OWNER}/${REPO}/git/matching-refs/heads/fix/issue-${issueNum}`)
      .catch(() => []),
  ]);

  const { items, issueComments, pullRequests } = boardData;
  const type = detectType(
    (issueJSON.labels ?? []).map((l: any) => l.name)
  );
  const chain = chainForType(type);

  // Find branch from PR or refs
  let branch = "";
  const matchingPR = pullRequests.find((pr) =>
    pr.headRefName.includes(`issue-${issueNum}`)
  );
  if (matchingPR) {
    branch = matchingPR.headRefName;
  } else if (Array.isArray(refsData) && refsData.length > 0) {
    branch = refsData[0].ref.replace("refs/heads/", "");
  }

  // Get comments from board data, fallback to REST if not found
  let effectiveComments = issueComments[issueNum] ?? [];
  if (effectiveComments.length === 0) {
    try {
      const commentsData = await restGet(
        `/repos/${OWNER}/${REPO}/issues/${issueNum}/comments?per_page=30`
      );
      effectiveComments = commentsData.map((c: any) => c.body);
    } catch {
      // No comments
    }
  }

  // Determine completed steps and next agent
  const hasLunaHandoff = effectiveComments.some((c) =>
    c.includes("## Luna \u2192 FiremanDecko Handoff")
  );
  const hasDeckoHandoff = effectiveComments.some((c) =>
    c.includes("## FiremanDecko \u2192 Loki Handoff")
  );
  const hasHeimdallHandoff = effectiveComments.some((c) =>
    c.includes("## Heimdall \u2192 Loki Handoff")
  );
  const hasLokiVerdict = effectiveComments.some((c) =>
    c.includes("## Loki QA Verdict")
  );
  const lokiPass = effectiveComments.some(
    (c) => c.includes("## Loki QA Verdict") && /Verdict.*PASS/.test(c)
  );
  const lokiFail = effectiveComments.some(
    (c) => c.includes("## Loki QA Verdict") && /Verdict.*FAIL/.test(c)
  );
  const hasResearchHandoff = effectiveComments.some(
    (c) =>
      c.includes("## Freya Handoff") ||
      (c.includes("## FiremanDecko Handoff") && !c.includes("\u2192 Loki"))
  );

  let completedSteps: string[] = [];
  let nextAgent = "";
  let nextStep = 0;
  let totalSteps = 0;

  switch (type) {
    case "bug":
    case "enhancement":
      totalSteps = 2;
      if (hasDeckoHandoff) {
        completedSteps = ["FiremanDecko"];
        nextAgent = "Loki";
        nextStep = 2;
      } else if (hasLokiVerdict) {
        completedSteps = ["FiremanDecko", "Loki"];
        nextAgent = "";
        nextStep = 0;
      } else {
        nextAgent = "FiremanDecko";
        nextStep = 1;
      }
      break;
    case "ux":
      totalSteps = 3;
      if (hasLokiVerdict) {
        completedSteps = ["Luna", "FiremanDecko", "Loki"];
        nextAgent = "";
        nextStep = 0;
      } else if (hasDeckoHandoff) {
        completedSteps = ["Luna", "FiremanDecko"];
        nextAgent = "Loki";
        nextStep = 3;
      } else if (hasLunaHandoff) {
        completedSteps = ["Luna"];
        nextAgent = "FiremanDecko";
        nextStep = 2;
      } else {
        nextAgent = "Luna";
        nextStep = 1;
      }
      break;
    case "security":
      totalSteps = 2;
      if (hasHeimdallHandoff) {
        completedSteps = ["Heimdall"];
        nextAgent = "Loki";
        nextStep = 2;
      } else if (hasLokiVerdict) {
        completedSteps = ["Heimdall", "Loki"];
        nextAgent = "";
        nextStep = 0;
      } else {
        nextAgent = "Heimdall";
        nextStep = 1;
      }
      break;
    case "research":
      totalSteps = 1;
      if (hasResearchHandoff) {
        completedSteps = [hasResearchHandoff ? "Research Agent" : ""];
        nextAgent = "Orchestrator Review";
        nextStep = 0;
      } else {
        nextAgent = "FiremanDecko";
        nextStep = 1;
      }
      break;
    default:
      totalSteps = 1;
      nextAgent = "FiremanDecko";
      nextStep = 1;
  }

  const result = {
    issue: issueNum,
    title: issueJSON.title,
    state: issueJSON.state,
    type,
    chain,
    branch,
    pr: matchingPR?.number ?? null,
    completed_steps: completedSteps,
    next_agent: nextAgent,
    next_step: nextStep,
    total_steps: totalSteps,
    verdict: lokiPass ? "PASS" : lokiFail ? "FAIL" : null,
    chain_complete:
      hasLokiVerdict || (type === "research" && completedSteps.length > 0),
  };

  console.log(JSON.stringify(result, null, 2));
}

// --- Peek (Up Next Queue) ---

async function peek() {
  const { items } = await fetchBoardAndComments();
  const upNext = items.filter((i) => i.status === "Up Next");

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

  upNext.sort((a, b) => {
    const aPri = Math.min(...a.labels.map((l) => priorityOrder[l] ?? 2));
    const bPri = Math.min(...b.labels.map((l) => priorityOrder[l] ?? 2));
    if (aPri !== bPri) return aPri - bPri;

    const aType = Math.min(...a.labels.map((l) => typeOrder[l] ?? 3));
    const bType = Math.min(...b.labels.map((l) => typeOrder[l] ?? 3));
    if (aType !== bType) return aType - bType;

    return a.num - b.num;
  });

  const result = upNext.map((item) => ({
    num: item.num,
    title: item.title,
    priority: detectPriority(item.labels),
    type: detectType(item.labels),
    chain: chainForType(detectType(item.labels)),
  }));

  console.log(JSON.stringify(result, null, 2));
}

// --- CLI ---

const args = process.argv.slice(2);
const cmd = args[0] ?? "--status";

switch (cmd) {
  case "--status":
    await statusDashboard();
    break;
  case "--chain-status":
    await chainStatus(Number(args[1]));
    break;
  case "--resume-detect":
    await resumeDetect(Number(args[1]));
    break;
  case "--peek":
    await peek();
    break;
  case "--move":
    await moveIssue(Number(args[1]), args[2]);
    break;
  default:
    console.error(
      "Usage: pack-status.ts [--status] [--chain-status N] [--resume-detect N] [--peek] [--move N <status>]"
    );
    process.exit(1);
}
