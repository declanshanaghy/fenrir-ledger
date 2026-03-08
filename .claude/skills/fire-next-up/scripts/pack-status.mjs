#!/usr/bin/env -S npx tsx

// .claude/skills/fire-next-up/scripts/pack-status.ts
import { execSync } from "child_process";
var OWNER = "declanshanaghy";
var REPO = "fenrir-ledger";
var PROJECT_NUMBER = 1;
var PROJECT_ID = "PVT_kwHOAAW5PM4BQ7LP";
var FIELD_ID = "PVTSSF_lAHOAAW5PM4BQ7LPzg-54RA";
var STATUS_OPTIONS = {
  "up-next": "6e492bcc",
  "in-progress": "1d9139d4",
  done: "c5fe053a"
};
function gh(args2) {
  return execSync(`gh ${args2}`, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }).trim();
}
function ghGraphQL(query, variables = {}) {
  const varsStr = Object.entries(variables).map(([k, v]) => {
    if (typeof v === "number") return `-F ${k}=${v}`;
    return `-f ${k}=${String(v)}`;
  }).join(" ");
  const escapedQuery = query.replace(/'/g, "'\\''");
  try {
    const raw = execSync(
      `gh api graphql -f query='${escapedQuery}' ${varsStr}`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
    return JSON.parse(raw);
  } catch (e) {
    if (e.stdout) {
      try {
        return JSON.parse(e.stdout);
      } catch {
      }
    }
    throw e;
  }
}
function fetchBoardAndComments() {
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          items(first: 100) {
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
      repository(owner: $owner, name: "${REPO}") {
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
  const result = ghGraphQL(query, { owner: OWNER, number: PROJECT_NUMBER });
  const projectItems = result.data.user.projectV2.items.nodes;
  const items = [];
  const issueComments = {};
  for (const item of projectItems) {
    if (!item.content?.number) continue;
    const status = item.fieldValueByName?.name ?? "Unknown";
    const labels = (item.content.labels?.nodes ?? []).map((l) => l.name);
    items.push({
      num: item.content.number,
      title: item.content.title,
      labels,
      status
    });
    if (item.content.comments?.nodes) {
      issueComments[item.content.number] = item.content.comments.nodes.map(
        (c) => c.body
      );
    }
  }
  const prs = (result.data.repository.pullRequests.nodes ?? []).map((pr) => ({
    number: pr.number,
    title: pr.title,
    headRefName: pr.headRefName,
    state: pr.state
  }));
  return { items, issueComments, pullRequests: prs };
}
function detectType(labels) {
  if (labels.includes("bug")) return "bug";
  if (labels.includes("security")) return "security";
  if (labels.includes("ux")) return "ux";
  if (labels.includes("enhancement")) return "enhancement";
  if (labels.includes("research")) return "research";
  return "unknown";
}
function detectPriority(labels) {
  if (labels.includes("critical")) return "critical";
  if (labels.includes("high")) return "high";
  if (labels.includes("low")) return "low";
  return "normal";
}
function chainForType(type) {
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
function analyzeChain(item, comments, prs) {
  const type = detectType(item.labels);
  const priority = detectPriority(item.labels);
  const chain = chainForType(type);
  const matchingPR = prs.find(
    (pr) => pr.headRefName.includes(`issue-${item.num}`)
  );
  const hasLokiPass = comments.some(
    (c) => c.includes("## Loki QA Verdict") && /Verdict.*PASS/.test(c)
  );
  const hasLokiFail = comments.some(
    (c) => c.includes("## Loki QA Verdict") && /Verdict.*FAIL/.test(c)
  );
  const hasDeckoHandoff = comments.some(
    (c) => c.includes("## FiremanDecko \u2192 Loki Handoff")
  );
  const hasHeimdallHandoff = comments.some(
    (c) => c.includes("## Heimdall \u2192 Loki Handoff")
  );
  const hasLunaHandoff = comments.some(
    (c) => c.includes("## Luna \u2192 FiremanDecko Handoff")
  );
  let position;
  let verdict = null;
  let next_action;
  let command;
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
    // Would need separate checks per PR — skip for speed
    next_action,
    command
  };
}
function statusDashboard() {
  const { items, issueComments, pullRequests } = fetchBoardAndComments();
  const inProgress = items.filter((i) => i.status === "In Progress");
  const upNext = items.filter((i) => i.status === "Up Next");
  const chains = inProgress.map(
    (item) => analyzeChain(
      item,
      issueComments[item.num] ?? [],
      pullRequests
    )
  );
  const result = {
    in_flight: chains,
    in_flight_count: chains.length,
    up_next_count: upNext.length,
    up_next_top3: upNext.slice(0, 3).map((i) => ({
      num: i.num,
      title: i.title,
      labels: i.labels
    })),
    open_prs: pullRequests,
    verdicts: {
      pass: chains.filter((c) => c.verdict === "PASS").map((c) => c.issue),
      fail: chains.filter((c) => c.verdict === "FAIL").map((c) => c.issue),
      awaiting_loki: chains.filter((c) => c.position.includes("Awaiting Loki")).map((c) => c.issue),
      awaiting_decko: chains.filter((c) => c.position.includes("Awaiting FiremanDecko")).map((c) => c.issue),
      no_response: chains.filter((c) => c.position.includes("No PR") || c.position.includes("running")).map((c) => c.issue)
    },
    actions: chains.map((c) => ({
      issue: c.issue,
      command: c.command,
      reason: c.position
    }))
  };
  console.log(JSON.stringify(result, null, 2));
}
function chainStatus(issueNum) {
  const { items, issueComments, pullRequests } = fetchBoardAndComments();
  const item = items.find((i) => i.num === issueNum);
  if (!item) {
    console.error(`Issue #${issueNum} not found on project board`);
    process.exit(1);
  }
  const status = analyzeChain(item, issueComments[issueNum] ?? [], pullRequests);
  console.log(JSON.stringify(status, null, 2));
}
function moveIssue(issueNum, status) {
  const optionId = STATUS_OPTIONS[status];
  if (!optionId) {
    console.error(`Invalid status: ${status} (use up-next, in-progress, done)`);
    process.exit(1);
  }
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          items(first: 100) {
            nodes {
              id
              content { ... on Issue { number } }
            }
          }
        }
      }
    }
  `;
  const result = ghGraphQL(query, { owner: OWNER, number: PROJECT_NUMBER });
  const node = result.data.user.projectV2.items.nodes.find(
    (n) => n.content?.number === issueNum
  );
  if (!node) {
    console.error(`Issue #${issueNum} not found on project board`);
    process.exit(1);
  }
  gh(
    `project item-edit --project-id "${PROJECT_ID}" --id "${node.id}" --field-id "${FIELD_ID}" --single-select-option-id "${optionId}"`
  );
  console.log(`Moved #${issueNum} to ${status}`);
}
function resumeDetect(issueNum) {
  const { items, issueComments, pullRequests } = fetchBoardAndComments();
  const item = items.find((i) => i.num === issueNum);
  const issueJSON = JSON.parse(gh(`issue view ${issueNum} --json number,title,body,labels,state`));
  const type = detectType((issueJSON.labels ?? []).map((l) => l.name));
  const chain = chainForType(type);
  const branches = gh(`api repos/${OWNER}/${REPO}/branches --paginate --jq '.[].name'`).split("\n").filter((b) => b.includes(`issue-${issueNum}`));
  const branch = branches[0] ?? "";
  const matchingPR = pullRequests.find(
    (pr) => pr.headRefName.includes(`issue-${issueNum}`)
  );
  const comments = issueComments[issueNum] ?? [];
  const hasLunaHandoff = comments.some((c) => c.includes("## Luna \u2192 FiremanDecko Handoff"));
  const hasDeckoHandoff = comments.some((c) => c.includes("## FiremanDecko \u2192 Loki Handoff"));
  const hasHeimdallHandoff = comments.some((c) => c.includes("## Heimdall \u2192 Loki Handoff"));
  const hasLokiVerdict = comments.some((c) => c.includes("## Loki QA Verdict"));
  const lokiPass = comments.some((c) => c.includes("## Loki QA Verdict") && /Verdict.*PASS/.test(c));
  const lokiFail = comments.some((c) => c.includes("## Loki QA Verdict") && /Verdict.*FAIL/.test(c));
  let completedSteps = [];
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
    chain_complete: hasLokiVerdict || type === "research" && completedSteps.length > 0
  };
  console.log(JSON.stringify(result, null, 2));
}
function peek() {
  const { items } = fetchBoardAndComments();
  const upNext = items.filter((i) => i.status === "Up Next");
  const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
  const typeOrder = { bug: 0, security: 1, ux: 2, enhancement: 3, research: 4 };
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
    chain: chainForType(detectType(item.labels))
  }));
  console.log(JSON.stringify(result, null, 2));
}
var args = process.argv.slice(2);
var cmd = args[0] ?? "--status";
switch (cmd) {
  case "--status":
    statusDashboard();
    break;
  case "--chain-status":
    chainStatus(Number(args[1]));
    break;
  case "--resume-detect":
    resumeDetect(Number(args[1]));
    break;
  case "--peek":
    peek();
    break;
  case "--move":
    moveIssue(Number(args[1]), args[2]);
    break;
  default:
    console.error(
      "Usage: pack-status.ts [--status] [--chain-status N] [--resume-detect N] [--peek] [--move N <status>]"
    );
    process.exit(1);
}
