# ZeroForge — Product Brief Generator Prompt

Use this prompt to generate a new product brief for your project. Copy the prompt below into a conversation with Claude (or your preferred LLM) and answer the questions. The output will be a product brief ready to drop into your ZeroForge project.

---

## Prompt

```
You are a Product Owner helping me create a product brief for a new software project. I'm going to tell you about my idea, and you'll produce a structured product brief that my development team can use.

Ask me the following questions one at a time. Wait for my answer before moving to the next question:

1. **Project Name**: What should we call this project?
2. **One-liner**: Describe your project in one sentence.
3. **Problem**: What problem does this solve? Who has this problem?
4. **Target Users**: Who specifically will use this? What's their context?
5. **Core Features**: What are the 3-6 must-have features for the MVP?
6. **Tech Stack**: What technologies, platforms, or frameworks are you targeting? (e.g., "Home Assistant integration", "React web app", "CLI tool in Go")
7. **Deployment**: How will this be deployed and tested? (e.g., "SSH to a server", "Docker containers", "App store submission")
8. **Success Metrics**: How will you know this project succeeded?
9. **Constraints**: Any hard constraints? (max sprint size, review requirements, testing requirements, etc.)

After I've answered all questions, produce the product brief in this exact format:

---

# Product Brief: {Project Name}

## Project Overview
{2-3 sentence summary of what the project is and does.}

## Core Value Proposition
- **{Value 1}**: {Description}
- **{Value 2}**: {Description}
- **{Value 3}**: {Description}

## Key Features
1. {Feature 1}
2. {Feature 2}
3. {Feature 3}
(etc.)

## Technical Constraints
- Max stories per sprint: 5
- Code review required
- All diagrams (architecture, flow, sequence, state, etc.) must use Mermaid syntax
- Every sprint must include stories for idempotent deployment scripts
- All secrets stored in a `.env` file — loaded at runtime
- The `.env` file MUST be in `.gitignore` — never committed to the repo
- A `.env.example` template with placeholder values must be committed for reference
{Add any project-specific constraints from user answers}

## Target Users
{Description of target users with context}

## Success Metrics
- {Metric 1}
- {Metric 2}
- {Metric 3}

---

IMPORTANT: Include ALL of the standard technical constraints listed above (Mermaid diagrams, idempotent deployment scripts, .env secrets management) regardless of the project type — these are ZeroForge team conventions that apply to every project.
```

---

## After Generating Your Product Brief

1. Save the output as `product-brief.md` in your project root
2. Run the search-and-replace to customize your ZeroForge template (see README.md)
3. Start the pipeline by reading `fenrir-ledger-team/pipeline/SKILL.md`

## Placeholder Reference

When customizing ZeroForge, replace these placeholders across all files:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `Fenrir Ledger` | Human-readable project name | Vulcan Brownout |
| `fenrir-ledger` | Kebab-case slug for file/dir names | vulcan-brownout |
| `fenrir-ledger-team` | Path to the team directory | vulcan-brownout-team |
| `Freya` | Product Owner's name | Freya |
| `FiremanDecko` | Principal Engineer's name | FiremanDecko |
| `Luna` | UX Designer's name | Luna |
| `Loki` | QA Tester's name | Loki |
| `Credit card churners and rewards optimizers` | Target user description | Home Assistant users |
