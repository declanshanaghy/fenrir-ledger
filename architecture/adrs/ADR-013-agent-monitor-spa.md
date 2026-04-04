# ADR-013: Agent Monitor — Real-time GKE Agent Log Streaming SPA

**Status:** Accepted
**Date:** 2026-03-14
**Deciders:** FiremanDecko (Principal Engineer)
**Issue:** #743

---

## Context

Currently, viewing real-time GKE agent logs requires terminal access and `kubectl logs` commands. There is no web-based visibility into what agents are doing, whether they're stuck, or what tools they're calling. This creates friction for developers and operators who want quick insight into agent status without SSH/terminal access.

We need a lightweight, no-build tool for real-time agent visibility on GKE.

---

## Decision

We will build **Agent Monitor**, a standalone single-file HTML+JS SPA (no framework, no build step) that:

1. **Runs in browser** — Opens directly via `file://` or HTTP server
2. **Uses K8s API proxy** — Connects to `kubectl proxy` running on localhost:8001
3. **Fetches job list** — Lists active/recent agent jobs in `fenrir-agents` namespace
4. **Streams live logs** — Real-time SSE from selected job via K8s API
5. **Parses structured logs** — Claude Code `stream-json` format into color-coded events
6. **Dark theme** — Matches Fenrir Ledger aesthetic (void-black + gold)
7. **Responsive layout** — Job list (left) + log viewer (right), collapses on mobile

---

## Rationale

### Why Standalone SPA?

- **Zero deployment**: No build step, no CI/CD pipeline, no artifact registry
- **Instant iteration**: Edit HTML, reload browser — changes immediate
- **No server dependency**: Client-side tool, uses K8s API directly
- **Low attack surface**: Browser sandbox, no backend, no sensitive secrets

### Why K8s API Proxy?

- **Standard tool**: `kubectl proxy` is built into kubectl, requires zero setup beyond cluster access
- **Automatic auth**: Uses kubeconfig; no separate credentials management
- **Local-only**: Runs on localhost — no exposure to internet

### Why Not Embed in Fenrir Ledger?

- **Separate concern**: Agent monitoring ≠ ledger management
- **Access pattern**: Developers/ops view it, not end users
- **Different auth**: Could be GKE admin auth, not OAuth
- **Deployment**: No need to ship with main app, can iterate independently

### Why Color-Coded Events?

Reuses parsing logic from `infrastructure/k8s/agents/agent-logs.mjs`:
- Tool calls = green (actionable)
- Errors = red (attention)
- Results = gold (success/summary)
- System = gray (metadata)

Makes scanning logs fast and visual.

### Why Single HTML File?

- **Portability**: Copy to laptop, any browser can open it
- **No toolchain**: No Node.js, no webpack, no build plugins
- **Minimal footprint**: ~15KB gzipped (including CSS + JS inline)
- **Versioning**: Just git-track the file, no package.json complexity

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Browser (Agent Monitor SPA)                             │
│                                                         │
│ ┌──────────────────────────┐ ┌─────────────────────┐   │
│ │ Job List                 │ │ Log Viewer          │   │
│ │ ┌──────────────────────┐ │ ┌─────────────────────┐   │
│ │ │ Refresh Button       │ │ │ Header (metadata)   │   │
│ │ ├──────────────────────┤ │ ├─────────────────────┤   │
│ │ │ Job 1 (Running)      │ │ │ Job Name            │   │
│ │ │ Job 2 (Succeeded)    │ │ │ Session ID | Status │   │
│ │ │ Job 3 (Failed)       │ │ ├─────────────────────┤   │
│ │ │ (scroll)             │ │ │ [Colored Log Events]│   │
│ │ │                      │ │ │ - green tool calls  │   │
│ │ │ Click to select →    │─┼─→ - red errors       │   │
│ │ │                      │ │ │ - gold results      │   │
│ │ └──────────────────────┘ │ │ (auto-scroll)       │   │
│ │                          │ └─────────────────────┘   │
│ └──────────────────────────┘                           │
│         ▲                      ▲                        │
│         └──────────┬───────────┘                        │
└──────────────────────┼─────────────────────────────────┘
                       │
        ┌──────────────┘
        │
  localhost:8001 (kubectl proxy)
        │
        ▼
  ┌──────────────────────────┐
  │ K8s API Server           │
  │                          │
  │ GET /namespaces/         │
  │     fenrir-agents/jobs   │ → List jobs
  │                          │
  │ GET /namespaces/         │
  │     fenrir-agents/pods?  │
  │     labelSelector=...    │ → Find pod for job
  │                          │
  │ GET /namespaces/         │
  │     fenrir-agents/pods/  │
  │     <name>/log?follow    │ → Stream logs
  │                          │
  └──────────────────────────┘
```

### Data Flow

1. **Load SPA** → Browser parses HTML, runs inline JS
2. **Init** → Connects to K8s API via `http://localhost:8001`
3. **List jobs** → Fetches `/api/v1/namespaces/fenrir-agents/jobs`
4. **Parse job metadata** → Extracts session ID, status, duration from labels/conditions
5. **Render job list** → Shows jobs sorted by status (Running first)
6. **Select job** → User clicks job item
7. **Find pod** → Query pod list with label selector `job-name=<jobname>`
8. **Stream logs** → Open streaming connection to pod `/log?follow=true`
9. **Parse log lines** → Each line as JSON (stream-json) or plain text
10. **Render event** → Color-code by type, append to log view
11. **Auto-scroll** → Keep viewport at bottom unless user scrolls up

### State Management

```typescript
interface State {
  jobs: AgentJob[];              // List of all jobs fetched
  selectedJobName: string | null;  // Currently viewing
  logEvents: LogEvent[];         // Parsed events for selected job
  isConnected: boolean;          // K8s API reachable?
  currentEventSource: EventSource | null; // Active stream
  autoScrollEnabled: boolean;    // Follow tail?
}
```

### Log Parsing

Handles two formats:

#### 1. Plain Text
```
[timestamp] Some log message
```
→ Rendered as white text

#### 2. Stream JSON (Claude Code)
```json
{"type": "text", "text": "Message"}
{"type": "tool_use", "name": "bash", "input": {...}}
{"type": "tool_result", "tool": "bash", "content": "...", "isError": false}
{"type": "error", "message": "..."}
{"type": "result", "usage": {...}, "duration": 1234}
{"type": "system", "text": "..."}
```

Each type color-coded, formatted for readability.

---

## Implementation Details

### File Structure
```
development/odins-throne/
├── index.html          # Single-file SPA (1700+ lines)
│                       # Includes:
│                       # - HTML structure
│                       # - Inline CSS (dark theme)
│                       # - Vanilla JS (ES2020+)
│                       # - Utility functions
│                       # - Event handlers
│                       # - Log parsing
│                       # - Rendering logic
│
├── Dockerfile          # Odin's Throne container image
└── README.md           # Setup, usage, troubleshooting (see k8s/agents/README.md)
```

> **Note:** The standalone `development/agent-monitor/` directory was merged into
> `development/odins-throne/` as part of the Odin's Throne unification. The SPA
> (`index.html`) is now served from the Odin's Throne Helm chart (`infrastructure/helm/odin-throne/`)
> in the `fenrir-monitor` namespace, behind oauth2-proxy.

### Key Functions

**Fetching:**
- `fetchJobs()` — List all jobs in fenrir-agents namespace
- `parseJobsList()` — Extract metadata from K8s Job objects
- `getPodNameForJob()` — Find pod for selected job
- `streamLogs()` — Open streaming connection to pod logs

**Parsing:**
- `parseLogLine()` — Split timestamp, try JSON parse, fall back to text
- `parseStreamJsonEvent()` — Map stream-json event types to typed LogEvent
- `addLogEvent()` — Buffer event, cap at 5000 (FIFO)

**Rendering:**
- `renderJobsList()` — HTML for job items, sorted by status
- `renderLogContent()` — HTML for log events with color classes
- `renderLogEvent()` — HTML for single event based on type

**UI:**
- `selectJob()` — Update header, stream logs, rerender jobs list
- `setConnectionStatus()` — Update indicator and text
- `formatDuration()` — Convert seconds to "1h 2m 3s" format
- `escapeHtml()` — XSS prevention

### Validation & Error Handling

**Job Name Validation:**
```
/^agent-[a-z0-9-]{1,60}$/
```
Rejects anything that doesn't start with `agent-` or has uppercase/special chars.

**Session ID Regex:**
```
/^issue-(\d+)-step(\d+)-(\w+)-[a-f0-9]+$/
```
Extracts issue number, step, agent name.

**Error Scenarios:**
- K8s API unreachable → "Connection error" + helpful message
- Pod not found → "Pod not found" (job still pending)
- Stream interrupted → "Stream interrupted" + retry option
- No jobs → "No Jobs Found" empty state

---

## Deployment

### For Users

**Option A: HTTP Server (Recommended)**
```bash
cd development/odins-throne
python3 -m http.server 9000

# In another terminal:
kubectl proxy

# In browser:
open http://localhost:9000
```

**Option B: Direct File URL**
```bash
# Just start kubectl proxy
kubectl proxy

# In browser address bar:
file:///path/to/repo/development/odins-throne/index.html
```

### Requirements

1. `kubectl` configured with cluster access
2. `kubectl proxy` running (standard tool)
3. Modern browser (Chrome/Firefox/Safari, ES2020+)

### Security Notes

- **No sensitive secrets in SPA** — Uses K8s API auth from kubeconfig
- **Localhost-only K8s API** — `kubectl proxy` doesn't expose to network
- **HTML escaping** — All log output escaped to prevent XSS
- **Read-only access** — Only fetches logs, never modifies resources

---

## Testing

### Unit Tests (Vitest)

Location: `development/ledger/src/__tests__/agent-monitor-utils.test.ts`

Tests:
- `formatDuration()` — seconds → "1h 2m 3s"
- `escapeHtml()` — XSS prevention
- `parseSessionId()` — Extract issue/step/agent from session ID
- `validateJobName()` — Job name format validation
- `parseStreamJsonEvent()` — JSON event parsing

Coverage: 38 tests, all passing

### Manual Testing Checklist

- [ ] Open SPA in browser
- [ ] List jobs appears after 2-3 seconds
- [ ] Click a running job
- [ ] Logs stream in real-time
- [ ] Events color-code correctly
- [ ] Refresh button works
- [ ] Job selection persists header
- [ ] Auto-scroll to bottom enabled by default
- [ ] Scroll up disables auto-scroll
- [ ] Scroll down re-enables auto-scroll
- [ ] Completed jobs show full log without follow
- [ ] Connection error handled gracefully

---

## Known Limitations

1. **No GKE-specific auth** — Relies on kubectl auth. For prod, would add GKE OIDC or Bearer token
2. **No RBAC enforcement in SPA** — Browser-side tool. K8s RBAC enforced server-side
3. **Log memory cap** — Max 5000 events (older dropped when exceeded)
4. **Completed jobs** — Stream ends when pod log exhausted
5. **TTL cleanup** — Jobs auto-delete after 30min; list naturally shows recent only
6. **No Mayo hecklers** — Intentionally omitted to keep SPA lightweight (could be added)

---

## Future Enhancements

- [ ] Job search/filter by issue, agent, status
- [ ] Export logs to file
- [ ] Multi-job tail (tail multiple jobs simultaneously)
- [ ] Job timeline visualization
- [ ] Agent metrics (tokens, cost, duration histograms)
- [ ] WebSocket for real-time updates (vs polling)
- [ ] Dark/light theme toggle
- [ ] Mayo GAA heckler mode (Easter egg)

---

## References

- **Issue:** #743
- **Spec:** Issue description and acceptance criteria
- **Related:** infrastructure/adrs/ADR-004-gke-jobs-agent-execution.md (Agent Job Infrastructure — formerly referenced as ADR-012)
- **CLI tool:** `infrastructure/k8s/agents/agent-logs.mjs` (parsing logic reference)

---

## Decision Record

**Approved:** 2026-03-14
**Implementation:** FiremanDecko
**Review:** Loki (QA)

---

## Changelog

**v1.0** (2026-03-14)
- Initial implementation
- Single-file SPA with K8s API proxy
- Job list + log streaming
- Color-coded event display
- Responsive layout
- Comprehensive README
- Unit tests (38 passing)
