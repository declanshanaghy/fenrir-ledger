# Wireframes Index

## Overview
This directory contains HTML wireframes for Fenrir Ledger's user interface.
Wireframes show structure and layout only — no theme styling (colors, fonts, shadows).
Each wireframe includes annotations for responsive behavior and implementation notes.

## Directory Structure

```
wireframes/
├── chronicles/              # Prose Edda (blog) pages
│   ├── chronicle-index.html
│   ├── chronicle-article.html
│   ├── chronicle-field-report.html
│   └── theme-variants.html
├── import/                  # Import flow wireframes
│   └── ...
├── light-theme-lightning.html    # Lightning theme wireframe
├── light-theme-stone.html        # Stone theme wireframe
└── profile-dropdown-my-cards.html # Profile dropdown wireframe
```

## Chronicle Wireframes (NEW)

### chronicle-index.html
- **Purpose:** Prose Edda listing page showing all chronicles
- **Features:** Card grid layout, responsive columns, theme-aware styling
- **URL:** `/chronicles`

### chronicle-article.html
- **Purpose:** Individual chronicle article template
- **Features:** Compact header, prev/next navigation at top, table of contents, agent messages
- **URL:** `/chronicles/{slug}`

### chronicle-field-report.html
- **Purpose:** Special chronicle variant with custom components
- **Features:** Grievance cards, Hunt List table, UPDATE banners, classified document styling
- **Example:** `/chronicles/depot-integration-issues`

### theme-variants.html
- **Purpose:** Visual guide showing light/dark theme behavior
- **Features:** Side-by-side comparison of all components in both themes
- **Implementation:** Color values, typography, and contrast guidelines

## Existing Wireframes

### light-theme-lightning.html
- **Purpose:** Lightning visual theme exploration
- **Features:** Electric gold accents, dynamic feel

### light-theme-stone.html
- **Purpose:** Stone visual theme exploration
- **Features:** Carved stone aesthetics, ancient runes

### profile-dropdown-my-cards.html
- **Purpose:** User profile dropdown menu
- **Features:** My Cards section, settings, logout

## Design Principles

1. **Mobile-first:** 375px minimum viewport
2. **Semantic HTML:** Proper element usage for accessibility
3. **Layout CSS only:** No colors, backgrounds, or theme styling in wireframes
4. **Annotations:** Implementation notes included as HTML comments or `.note` blocks
5. **Responsive breakpoints:**
   - Mobile: <600px (single column, compact)
   - Tablet: 600-1024px (limited columns, touch-friendly)
   - Desktop: >1024px (full layout, multi-column)

## Implementation Notes

### Chronicle Pages
- Remove hardcoded dark theme from `chronicle.css`
- Use Next.js `next-themes` for theme switching
- Typography: Cinzel (headings), Source Serif 4 (body), JetBrains Mono (code)
- Respect marketing site's existing theme system
- Maintain special Field Report components but adapt to themes

### Theme Colors
Light theme:
- Background: #ffffff
- Foreground: #1a1a1a
- Muted: #6b6b6b
- Border: #e0e0e0
- Accent: #c9920a

Dark theme:
- Background: #0f1018
- Foreground: #e8e4d4
- Muted: #8a8578
- Border: #1e2235
- Accent: #f0b429