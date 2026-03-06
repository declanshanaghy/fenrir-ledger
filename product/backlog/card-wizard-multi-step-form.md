# Product Design Brief: Multi-Step Card Wizard

**Priority**: P2-High | **Sprint**: Next | **Max stories**: 3

## Problem Statement

The current "Add Card" form (`/cards/new`) presents all 12+ fields on a single screen. For credit card churners who add cards frequently, this creates unnecessary friction. Most new cards only need a handful of fields filled immediately (issuer, name, date, bonus tracking). The remaining fields (credit limit, notes) are rarely filled at creation time. The single-screen form makes the simple case feel heavy and discourages quick entry.

## Target User

Credit card churners and rewards optimizers managing 5-20+ cards. They add new cards after every approval and want to log the essentials (card identity + bonus tracking details) as fast as possible. They may come back later to fill in secondary details.

## Desired Outcome

A user can add a new card in under 30 seconds by filling only the fields they care about. Power users who want to capture everything can do so in a natural second step. The form never feels like a wall of fields.

## Step Grouping (Odin Decision)

### Step 1 — Card + Bonus Tracking (Required + Core Optional)

| Field | Required | Notes |
|-------|----------|-------|
| Issuer | Yes | Select from KNOWN_ISSUERS |
| Card Name | Yes | Free text, max 100 chars |
| Open Date | Yes | Date picker, defaults to today |
| Annual Fee | No | Dollar amount |
| Annual Fee Date | No | Auto-derived from Open Date (+1 year) |
| Bonus Type | No | points / miles / cashback |
| Bonus Amount | No | Numeric |
| Minimum Spend | No | Select from preset amounts |
| Bonus Deadline | No | Auto-derived from Open Date (+3 months) |
| Bonus Met | No | Checkbox |

**Rationale**: Churners care about bonus tracking above all else. Getting this on Step 1 means the most common workflow (add card + set bonus target) is a single step.

### Step 2 — Additional Details (All Optional)

| Field | Notes |
|-------|-------|
| Credit Limit | Select from preset amounts |
| Notes | Free text area |

**Rationale**: These fields are rarely filled at card creation time. Separating them reduces visual noise on Step 1 without hiding them.

## Interactions & User Flow

```mermaid
graph TD
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF
    classDef neutral fill:#F5F5F5,stroke:#E0E0E0,color:#212121

    start([User clicks "Add Card"]) --> step1[Step 1: Card + Bonus Tracking]
    step1 --> save1{User clicks "Save Card"}
    step1 --> next{User clicks "More Details"}
    save1 -->|Required fields valid| saved([Card saved, redirect to dashboard])
    save1 -->|Required fields invalid| errors[Highlight errors, scroll to first]
    errors --> step1
    next -->|Required fields valid| step2[Step 2: Credit Limit + Notes]
    next -->|Required fields invalid| errors
    step2 --> save2{User clicks "Save Card"}
    save2 --> saved

    class start neutral
    class step1,step2 primary
    class saved healthy
```

### Step Navigation

- **Two dots** at the top of the form indicate current step (filled = current/completed, unfilled = future). Low-key, not a full stepper bar.
- Step 1 has two action buttons in the right slot:
  - **"More Details"** (secondary/outline) -- advances to Step 2 if required fields pass validation.
  - **"Save Card"** (primary/gold) -- saves immediately with Step 1 data only. This is the quick-add path.
- Step 2 has:
  - **"Back"** (secondary/outline) -- returns to Step 1, preserving all entered data.
  - **"Save Card"** (primary/gold) -- saves with all data from both steps.
- **Cancel** button on both steps returns to dashboard.

### Animation Between Steps

Subtle slide transition using Framer Motion. Step 1 slides out left, Step 2 slides in from right (and vice versa for "Back"). Duration: 200-250ms, ease: `[0.16, 1, 0.3, 1]` (expo out). Must feel fast -- no sluggish carousel.

### Edit Mode

Editing an existing card does NOT use the wizard. The existing single-page form with all fields visible is preserved for edit mode. The wizard is for `/cards/new` only.

**Rationale**: When editing, the user already has context and wants to see/change any field. Stepping through a wizard to find the field they want to edit would be frustrating.

## Error Handling & Disabled States (Project-Wide Convention)

### Disabled Buttons Must Explain Why

When a button is disabled, the user must understand the reason. Two patterns are acceptable:

1. **Tooltip on hover/focus**: The disabled button shows a tooltip explaining the reason (e.g., "Fill in required fields to save"). Use `title` attribute or a proper tooltip component. Must be keyboard-accessible via `:focus-visible`.
2. **Inline helper text**: A short text line below or beside the button group explaining what is blocking the action (e.g., "Issuer, card name, and open date are required").

The tooltip pattern is preferred for space efficiency. The inline text pattern is acceptable when the form layout has room and the message is contextually useful.

### Required Field Error Highlighting

When the user attempts to save with missing required fields:

1. Each invalid field receives a red border (`border-destructive`) and an error message below the field in `text-destructive`.
2. The form scrolls to the first invalid field (existing `scrollToFirstError` pattern).
3. The first invalid field receives focus.
4. Error messages clear when the user corrects the field (react-hook-form handles this via `mode: "onChange"` or on next submit).

## Look & Feel Direction

- Same card/panel aesthetic as the rest of the app. The wizard is not a modal -- it replaces the current full-page form layout.
- Step indicator dots use the gold accent color for the active/completed step, muted for the upcoming step.
- Mobile (375px): same interactions as desktop, layout adjusts to fit. Fields stack vertically as they already do. The two action buttons ("More Details" + "Save Card") stack vertically on mobile if needed for touch target size.
- The "Save Card" button is always the rightmost (or bottommost on mobile) action, consistent with the existing button layout convention.

## Market Fit & Differentiation

Every competing card tracker (CardPointers, MaxRewards, AwardWallet) uses a single long form. A 2-step wizard with a quick-save escape hatch is a small but meaningful UX improvement for frequent churners who add 2-5 cards per month.

## Acceptance Criteria

### Wizard Structure
- [ ] `/cards/new` renders a 2-step wizard (Step 1: Card + Bonus, Step 2: Credit Limit + Notes)
- [ ] Step indicator shows 2 dots reflecting current step
- [ ] Step 1 contains: Issuer, Card Name, Open Date, Annual Fee, Annual Fee Date, Bonus Type, Bonus Amount, Minimum Spend, Bonus Deadline, Bonus Met
- [ ] Step 2 contains: Credit Limit, Notes
- [ ] Edit mode (`/cards/[id]/edit`) continues to use the existing single-page form

### Save & Navigation
- [ ] "Save Card" button on Step 1 saves the card with Step 1 data only and redirects to dashboard
- [ ] "More Details" button on Step 1 advances to Step 2 (only if required fields are valid)
- [ ] "Save Card" button on Step 2 saves with all data and redirects to dashboard
- [ ] "Back" button on Step 2 returns to Step 1 with all data preserved
- [ ] "Cancel" button on both steps returns to dashboard without saving

### Validation & Error Handling
- [ ] Required fields (Issuer, Card Name, Open Date) are validated before save or step advance
- [ ] Invalid fields show red border + error message below the field
- [ ] Form scrolls to first invalid field and focuses it on validation failure
- [ ] Disabled "Save Card" button shows tooltip explaining why it is disabled (when required fields are empty)
- [ ] Error messages clear when the user corrects the field

### Animation & Polish
- [ ] Subtle slide animation between steps (200-250ms, Framer Motion)
- [ ] `prefers-reduced-motion` disables slide animation (instant swap)
- [ ] Step dots animate the active state transition

### Mobile & Accessibility
- [ ] Layout holds at 375px with no horizontal overflow
- [ ] All touch targets are >= 44x44px
- [ ] Step indicator is keyboard-navigable and has appropriate ARIA labels
- [ ] Form fields maintain existing ARIA attributes and focus management

### Existing Behavior Preserved
- [ ] Gleipnir Fragment 4 (Bear Sinews) still triggers on 7th card save
- [ ] Milestone toasts still fire on new card creation
- [ ] Open Date auto-derives Annual Fee Date (+1 year) and Bonus Deadline (+3 months)
- [ ] All Zod validation rules from the existing form are preserved

## Priority & Constraints

- **Priority**: P2-High
- **Sprint target**: Next sprint
- **Dependencies**: None -- this is a frontend-only refactor of CardForm.tsx
- **Max stories this sprint**: 3 (this feature is scoped to 3 stories)

## User Stories

### W.1: Wizard Shell + Step 1

**As a** credit card churner
**I want** a focused first step with card identity and bonus tracking fields
**So that** I can add a new card quickly without scrolling past fields I do not need yet

**Priority**: P1-Critical | **Status**: Backlog

- [ ] Step 1 renders Issuer, Card Name, Open Date, Annual Fee, Annual Fee Date, Bonus Type, Bonus Amount, Minimum Spend, Bonus Deadline, Bonus Met
- [ ] 2-dot step indicator at top
- [ ] "Save Card" primary button saves from Step 1
- [ ] "More Details" secondary button advances to Step 2
- [ ] "Cancel" returns to dashboard
- [ ] Required field validation with scroll-to-first-error
- [ ] Disabled save button shows tooltip when required fields are empty
- [ ] Edit mode bypasses wizard, renders existing single-page form

**UX Notes**: See step grouping table and flow diagram in this brief.

### W.2: Step 2 + Data Persistence Across Steps

**As a** credit card churner who wants to add credit limit or notes
**I want** a second step for optional details with all my Step 1 data preserved
**So that** I can capture everything in one flow without losing what I already entered

**Priority**: P1-Critical | **Status**: Backlog

- [ ] Step 2 renders Credit Limit and Notes fields
- [ ] "Save Card" saves all data from both steps
- [ ] "Back" returns to Step 1 with all data preserved (no data loss)
- [ ] All existing form logic preserved: Zod schema, dollarsToCents, computeCardStatus, Gleipnir Fragment 4, milestone toasts
- [ ] Open Date auto-derive logic works across steps

**UX Notes**: react-hook-form state persists across steps (single form instance, conditional field rendering).

### W.3: Step Animation + Mobile Polish

**As a** user on any device
**I want** smooth transitions between wizard steps and a polished mobile layout
**So that** the wizard feels fast and intentional, not janky

**Priority**: P2-High | **Status**: Backlog

- [ ] Framer Motion slide transition between steps (200-250ms)
- [ ] `prefers-reduced-motion` disables slide, uses instant swap
- [ ] Step dots animate active state
- [ ] Mobile layout (375px): fields stack, buttons stack if needed, no overflow
- [ ] Touch targets >= 44x44px on all interactive elements
- [ ] ARIA labels on step indicator ("Step 1 of 2: Card and Bonus Details")

**UX Notes**: Follow existing animation conventions from `ux/interactions.md`. Duration discipline: 200-250ms for step transitions.

## Open Questions for Principal Engineer

1. **Single form instance or two?** Recommendation: single `useForm` instance with conditional field rendering per step. This preserves react-hook-form state across steps without manual data passing.
2. **Step state management**: Simple `useState<1 | 2>(1)` or something more structured? Given only 2 steps, useState is sufficient.
3. **Framer Motion `AnimatePresence`**: Should each step be a keyed child for enter/exit animations, or use `layoutId` for shared elements?
4. **Tooltip component**: Does the project have a tooltip primitive from shadcn/ui already installed, or does one need to be added for the disabled-button tooltip?

## Handoff Notes for Principal Engineer

- **Key product decision**: Step 1 must be self-sufficient. A user who never clicks "More Details" has a complete, valid card. The wizard is an optimization, not a requirement.
- **Non-negotiable UX**: The "Save Card" button must be on Step 1. This is the quick-add path that justifies the wizard's existence. If save is only on Step 2, the wizard adds friction instead of removing it.
- **Edit mode stays single-page**: Do not refactor the edit path. Only `/cards/new` gets the wizard.
- **Disabled button explanation is a project-wide pattern**: This convention applies everywhere, not just the wizard. See the error handling section. Odin explicitly requested this.
- **Animation must be fast**: 200-250ms max. If it feels like waiting, it is too slow.
- **Acceptable trade-offs**: Step dot animation polish can be deprioritized if the core wizard + save behavior ships first. The slide animation can ship as an enhancement after the structural refactor.
