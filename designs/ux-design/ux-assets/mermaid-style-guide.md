# Fenrir Ledger — Mermaid Diagram Style Guide

All diagrams across the project must use Mermaid syntax. This guide defines the conventions, color palette, and patterns every team member follows when producing diagrams.

## General Rules

- Every diagram must be valid Mermaid syntax renderable by GitHub, GitLab, Mermaid Live Editor, or any standard Mermaid renderer
- Use `%%` comments to label sections within complex diagrams
- Keep diagrams focused — one concept per diagram. Split rather than cram.
- Use meaningful node IDs (not `A`, `B`, `C` — use `panel`, `backend`, `api`)
- Label all edges with the action or data being passed

## Color Palette

<!-- CUSTOMIZE: Replace these colors with your project's brand / platform colors -->

```
%% Fenrir Ledger Theme Colors
%% Primary:             #03A9F4
%% Background:          #1C1C1C (dark) / #FFFFFF (light)
%% Card background:     #2C2C2C (dark) / #F5F5F5 (light)
%% Critical / Error:    #F44336 (red)
%% Warning:             #FF9800 (amber)
%% Success / Healthy:   #4CAF50 (green)
%% Neutral / Disabled:  #9E9E9E (grey)
%% Accent:              #03A9F4 (primary)
%% Text primary:        #FFFFFF (dark) / #212121 (light)
%% Text secondary:      #B0B0B0 (dark) / #757575 (light)
```

### Applying Colors with `classDef`

```mermaid
graph TD
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef critical fill:#F44336,stroke:#D32F2F,color:#FFF
    classDef warning fill:#FF9800,stroke:#F57C00,color:#FFF
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF
    classDef unavailable fill:#9E9E9E,stroke:#757575,color:#FFF
    classDef background fill:#2C2C2C,stroke:#444,color:#FFF
    classDef neutral fill:#F5F5F5,stroke:#E0E0E0,color:#212121
```

Use these class names consistently. Don't invent new color classes without adding them here first.

## Diagram Types & When to Use Them

### Flowcharts (`graph TD` / `graph LR`)
Use for: architecture overviews, component relationships, deployment flows.

```mermaid
graph TD
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef neutral fill:#F5F5F5,stroke:#E0E0E0,color:#212121

    user[User opens app] --> frontend[Frontend UI]
    frontend -->|API call| backend[Backend Service]
    backend -->|Query| datastore[(Data Store)]
    datastore -->|Results| backend
    backend -->|Response| frontend

    class frontend primary
    class backend neutral
```

**Convention**: `TD` (top-down) for hierarchical views, `LR` (left-right) for flows and pipelines.

### Sequence Diagrams (`sequenceDiagram`)
Use for: API interactions, message flows, user interaction sequences.

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant S as Service

    U->>F: Performs action
    F->>A: API request
    A->>S: Process request
    S-->>A: Response data
    A-->>F: JSON response
    F->>U: Renders result
```

**Convention**: Always name participants with both short alias and descriptive label.

### State Diagrams (`stateDiagram-v2`)
Use for: UI component states, entity lifecycle, connection states.

```mermaid
stateDiagram-v2
    [*] --> Loading: App opens
    Loading --> Loaded: Data received
    Loading --> Error: Request failed
    Loaded --> Refreshing: Manual refresh
    Refreshing --> Loaded: Data received
    Refreshing --> Error: Request failed
    Error --> Loading: Retry clicked
    Loaded --> Loaded: Real-time update
```

**Convention**: Always show the `[*]` initial state and label every transition.

### Class Diagrams (`classDiagram`)
Use for: data models, module structure, entity relationships.

```mermaid
classDiagram
    class DataItem {
        +String id
        +String name
        +String status
        +datetime last_updated
    }

    class QueryParams {
        +int offset
        +int limit
        +String sort_by
        +String sort_order
    }
```

**Convention**: Use `+` for public, `-` for private. Include types.

### Gantt Charts (`gantt`)
Use for: sprint timelines, story dependencies, release planning.

```mermaid
gantt
    title Sprint 1 Timeline
    dateFormat  YYYY-MM-DD
    section Stories
    Story 1 scaffolding    :s1, 2026-01-01, 2d
    Story 2 UI rendering   :s2, after s1, 2d
    Story 3 status logic   :s3, after s1, 1d
    Story 4 error handling  :s4, after s2, 1d
    Story 5 deploy pipeline :s5, 2026-01-01, 3d
```

**Convention**: Use story IDs that match the sprint plan. Show dependencies with `after`.

## Node Shape Conventions

| Shape | Meaning | Syntax |
|-------|---------|--------|
| Rectangle | Process / Component | `[Label]` |
| Rounded | User action / UI element | `(Label)` |
| Stadium | Start / End point | `([Label])` |
| Cylinder | Database / Store | `[(Label)]` |
| Diamond | Decision | `{Label}` |
| Hexagon | External system | `{{Label}}` |
| Parallelogram | Input / Output | `[/Label/]` |

## Edge Style Conventions

| Style | Meaning | Syntax |
|-------|---------|--------|
| Solid arrow | Direct call / data flow | `-->` |
| Dotted arrow | Response / callback | `-.->` |
| Thick arrow | Critical path | `==>` |
| Labeled edge | Describe the action | `-->|action|` |

## File Naming

All Mermaid diagram files go in the relevant sprint or design directory:

- Architecture diagrams: `sprints/sprint-N/architecture/diagrams/`
- UX flow diagrams: `sprints/sprint-N/design/diagrams/`
- Inline in markdown: Preferred for most cases using fenced code blocks

When a diagram is referenced from multiple documents, save it as a standalone `.mermaid` file and reference it by path.

## Examples

### Bad
```
graph TD
    A --> B
    B --> C
    C --> D
```
No meaningful labels, no colors, generic node IDs.

### Good
```mermaid
graph TD
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF

    setup([User begins setup]) --> discover[Auto-discover resources]
    discover --> cache[Cache in memory]
    cache --> ui[Register UI panel]
    ui --> ready([Ready for use])

    class discover primary
    class ui primary
```

Descriptive IDs, labeled flow, colored key nodes, meaningful shapes.
