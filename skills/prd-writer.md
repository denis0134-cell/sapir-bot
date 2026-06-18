---
name: prd-writer
description: Write detailed, developer-ready PRDs (Product Requirements Documents) from scratch. Handles both vague ideas ("we need a loyalty system") and clear requirements ("add a currency selector dropdown"). Guides the user through requirement refinement via conversation, then outputs a comprehensive Markdown PRD. Use this skill whenever the user mentions PRD, product requirements, feature spec, product spec, requirements document, writing requirements, defining a feature, or says /prd-writer. Also trigger when the user describes a product idea and wants it documented in a structured way, even if they don't use the word "PRD".
---

# PRD Writer

Help users produce Product Requirements Documents that are detailed enough for a developer or AI agent to build from directly — no ambiguity, no gaps, no guessing.

The reason this level of detail matters: a PRD is often handed to an AI coding agent or a developer who wasn't in the room when decisions were made. Every vague sentence becomes a coin flip in the implementation. "Show an error message" could mean a toast, a modal, an inline message, or a redirect — if the PRD doesn't say which, someone has to guess, and they'll guess wrong half the time.

## Usage

```
/prd-writer [topic]
```

If a topic is provided, start with it. If not, ask what the user wants to build.

## Step 0: Check if This is an Update

If the user provides an existing PRD file (path or content), read it first. Then:

1. Summarize what the current PRD covers in 2-3 sentences
2. Ask what needs to change — new section, updated flow, scope change, etc.
3. Make targeted edits rather than rewriting from scratch. Preserve the existing structure and only modify what's needed.

If the user is starting from scratch, skip to Step 1.

## Step 1: Assess the Input

Read the user's input and decide which mode fits:

- **Vague** (e.g., "we need a points system", "add social features", "some kind of dashboard") → **Exploration Mode**
- **Clear** (e.g., "add a dropdown for selecting currencies, options come from /api/currencies") → **Structured Mode**

If genuinely unsure, ask one short question to disambiguate. Don't overthink this — most inputs are obviously one or the other.

## Step 2A: Exploration Mode

The goal is to turn a fuzzy idea into something concrete through conversation. Don't interrogate the user with a wall of questions — go one round at a time, each round focused on one dimension. Summarize what you've captured after each round so the user can correct misunderstandings early.

**Stop as soon as you have enough.** Small features (1-2 interactions) may need only 2-3 rounds. Medium features need 4-5. Only large systems with multiple user roles and complex state need all 7. Once you can write the PRD without guessing, tell the user you're ready and proceed to Step 3.

### Round sequence (adapt and skip as needed):

**Round 1 — Problem & Goal**
What problem are we solving? For whom? What does success look like?
This grounds everything else. If the user can't articulate the problem, help them find it — ask what's painful today, or what triggered this idea.

**Round 2 — Users & Roles**
Who uses this? Are there different permission levels? Where does the user first encounter this feature — is it a new page, a button in an existing flow, an email?

**Round 3 — References**
Are there existing products that do something similar? Ask the user if they have any references — competitor products, screenshots, links, or design mockups. Screenshots are often the most efficient way to align on expectations — a single screenshot can replace several rounds of back-and-forth about interaction details.

When the user shares screenshots:
- **Read them carefully** — identify specific UI elements, interaction patterns, layout structure, and data being displayed.
- **Use what you see to drive the discussion** — instead of asking abstract questions, point to specific elements in the screenshot: "I see this has a progress indicator at 1/3 — do we want the same pattern?" or "Their panel has a Skip button but no Back button — do we need Back?"
- **Surface differences** — if the user shares multiple references, compare them: "Lovable uses a dropdown to switch modes, Replit uses a checkbox — which do you prefer?"
- **Don't just file screenshots away** — they should actively shape the next rounds of discussion (Core Flow, Edge Cases, etc.)

Save screenshots to the PRD's `assets/` folder for reference. Not all screenshots need to appear in the final PRD — they may just be inspiration or discussion material. In the final document, distill insights from screenshots into conclusions (e.g., a comparison table), rather than listing screenshots one by one. Only embed a screenshot inline if it communicates something that text alone cannot. This round is optional — skip if the feature is novel or the user has no references.

**Round 4 — Core Flow**
Walk through the happy path step by step. What does the user see? What do they click? What happens? This is the backbone of the PRD — spend the most time here.

**Round 5 — Data & State**
What entities are involved? What are their states? How do they transition? This round often surfaces complexity the user hadn't thought about ("wait, can an order be both refunded AND partially shipped?").

**Round 6 — Edge Cases**
What breaks? Empty states, invalid input, network failures, race conditions, permission denied. Think like a QA engineer trying to break the feature. Propose edge cases the user may not have considered.

**Round 7 — Scope**
What's explicitly out? Is there phasing (MVP vs v2)? This prevents scope creep from sneaking into the document.

### Complexity calibration

Before generating, gauge the feature's size and calibrate the output:

- **Small** (a button, a toggle, a single modal): 1-2 pages. Skip Data Model, States, Non-Functional sections. Focus on the interaction and edge cases.
- **Medium** (a new page, a CRUD flow, a multi-step form): 3-5 pages. Include most sections from the template.
- **Large** (a new system, multi-role workflows, cross-service features): 5+ pages. Consider splitting into multiple PRDs (one per major component) with a parent overview doc.

## Step 2B: Structured Mode

The user already knows what they want. Your job is to take their clear requirement and:

1. Confirm you understand it correctly (one sentence paraphrase)
2. Proactively surface things they probably haven't considered:
   - What happens on loading? Empty state? Error?
   - Boundary conditions (max items, character limits, what if zero?)
   - Permission and access control implications
   - Mobile / responsive behavior (if it's a UI feature)
3. Ask about these gaps concisely — don't pad with unnecessary questions
4. Once gaps are filled, proceed to Step 3

## Step 3: Generate the PRD

Ask the user where to save the file. Default to `./docs/prd/<feature-name>.md`.

### Writing structure: narrative, not form-filling

The PRD should read like a document, not a filled-out template. Information flows from top to bottom, each section building on the previous one. A reader should be able to read it straight through without jumping back and forth.

Bad structure (fragmented, info repeated across sections):
```
## Supported File Types     ← lists file types
## File Limits              ← mentions file types again with limits
## Upload Flow              ← mentions file types again in context
## Edge Cases               ← mentions file types again for error handling
```

Good structure (follow the user's journey):
```
## Background & Goal        ← why we're doing this
## What's Supported         ← inputs, types, limits — all in one place
## How to [do the thing]    ← entry points, how the user starts
## What happens next        ← the flow after the user acts, step by step
## What the result looks like ← output, display, end state
## When Things Go Wrong     ← error cases, in the order they'd occur
## Open Items               ← what's not decided yet
```

The organizing principle is the **user's journey through the feature** — not categories, not template sections. Start from what the user has (input), walk through what they do (interaction), end with what they see (output). Error cases follow the same chronological order. A reader should be able to trace the entire feature lifecycle by reading top to bottom once.

Don't repeat information. If you mentioned file size limits when listing supported types, don't create a separate "Limits" section. If a piece of information belongs in context, put it in context.

### Deciding what to specify vs what to leave open

Not everything in a PRD needs to be nailed down by the PM. The rule of thumb:

**PM should define (be specific):**
- Functional behavior: what happens when the user does X
- Business rules: limits, permissions, conditions
- Error handling: what errors exist and what the user sees
- Data: what gets stored, what states exist
- Scope: what's in, what's out

**OK to leave for design (mark as "Pending design confirmation"):**
- Visual styling: colors, spacing, icon styles
- Layout details: exact positioning, responsive breakpoints
- Animation/transition: hover effects, loading animations
- Component choice: use a modal vs a slide-over panel

**OK to leave for engineering (don't specify):**
- Data storage implementation: database schema, caching strategy
- API design: endpoint structure, request/response format
- Frontend state management: how state is tracked internally
- Implementation mechanics: save behavior, debounce timing, polling intervals
- Technical architecture: service boundaries, build pipeline

If you're unsure whether something is a product decision or an implementation detail, leave it as an Open Question rather than guessing.

**Never leave vague:**
- "Show an error" — what error? What message? Where?
- "Display the file" — how? Thumbnail? Icon? File name?
- "Handle appropriately" — this means nothing, be explicit

When marking something for design, still describe the functional constraint: "Design should determine the exact layout, but the file list must not push the message text out of view when there are 10 files."

### Language

Match the user's language. If the user writes in Chinese, write the PRD in Chinese. If in English, write in English. Mixed usage is fine — follow whatever the user is doing.

### Handling images and screenshots

If the user shared screenshots or images during the conversation (e.g., reference designs, competitor UI, current state of a page), save them to an `assets/` folder next to the PRD file and reference them with relative paths:

```markdown
![当前登录页](./assets/current-login-page.png)
```

This keeps the PRD self-contained — whoever reads it (human or AI) can see the visual references inline. The output structure looks like:

```
docs/prd/
├── feature-name.md
└── assets/
    ├── current-login-page.png
    └── competitor-reference.png
```

Read `references/prd-template.md` for section-level reference on what to include (data models, API specs, state machines, etc.). Use it as a menu of possible sections, not a form to fill in. Only include sections that serve this specific feature.

### What makes a good PRD (vs a bad one)

**Bad — vague, leaves room for interpretation:**
> Users can filter the transaction list. Show appropriate error handling.

**Good — specific, actionable, no guessing:**
> The transaction list has 3 filter controls at the top:
> - **Date range**: date picker, defaults to "Last 30 days", max range 1 year
> - **Status**: multi-select dropdown with options: Pending, Completed, Failed, Refunded
> - **Amount**: two number inputs (min/max), accepts 0-999999.99, validates min ≤ max
>
> Filters apply on change (no "Apply" button). Show a loading spinner overlaying the table during fetch. If the filtered result is empty, show: "No transactions match your filters" with a "Clear filters" link. If the API call fails, show a toast: "Failed to load transactions. Please try again." with a retry button.

The difference: the good version can be built without asking a single follow-up question. That's the bar.

## Guidelines

Write the PRD as if the reader has zero context about the discussions that happened. They should be able to build the feature from the document alone. This means:

- **Specify actual strings**: button labels, error messages, placeholder text, toast messages. "Please enter a valid email address" not "show a validation error."
- **Describe every interaction**: what happens on click, on hover, on focus, on submit. If there's a form, every field needs: type, validation, error message, default value.
- **Include concrete examples**: instead of "users can search," show: search input with placeholder "Search by name or email...", debounce 300ms, minimum 2 characters, results update in real-time below.
- **Define states explicitly**: for any entity with a lifecycle, draw the state machine. What states exist? What transitions are valid? What triggers them? What's prevented?
- **Call out what's NOT included**: explicit exclusions prevent someone from building the wrong thing. "v1 does NOT include: bulk operations, CSV export, or admin override."
- **No information should appear twice**: if you mentioned it, don't repeat it in another section. If a reader has to Ctrl+F to check "did I already see this?", the structure is wrong.
- **Read it top to bottom**: after writing, re-read the whole document. Does it flow? Can you read it straight through without confusion? If not, reorganize.

If something is genuinely undecided, put it in Open Questions — don't pretend to have an answer or leave it silently ambiguous.
