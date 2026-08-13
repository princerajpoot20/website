# /discover

Build or refresh the project's navigable knowledge base — a structured map of the codebase that lets future work start from knowledge rather than exploration.

## When to use this
- First time setting up the spec kit on a project (one-time setup)
- After a major refactor that changed project structure significantly
- When knowledge feels stale or an area is flagged as TBD that you now want to fill
- Before starting complex work in an unfamiliar area

---

## Behavior

### Step 0 — Check for existing knowledge (always runs first)

Look for `.spec/knowledge/index.md`.

- **Not found** → first-time setup. Go to **Step 1**.
- **Found** → read it into context. Branch on the prompt in **Step 2**.

---

### Step 1 — First-time setup: initialize then build

#### Step 1a — Project identification (runs once, before building anything)

Read the primary manifest to identify the project:
- `package.json` → use the `name` field (strip any scope prefix like `@org/`)
- `pyproject.toml` → `[project] name`
- `go.mod` → module path last segment
- `Cargo.toml` → `[package] name`
- Fallback: use the current working directory folder name

Get the current git SHA:
```
git rev-parse --short HEAD
```
If git is not available or not a git repo, use `"no-sha"`.

**Print and confirm:**
> "Initializing Prince Spec Kit for: **{project-name}**
>
> Current SHA: `{sha}`
> Knowledge base will be created at: `.spec/knowledge/`
>
> If the project name looks wrong, say the correct name now. Otherwise, press Enter or say 'proceed'."

**Wait for confirmation or correction before continuing.**

After confirmation, apply the project name:
1. Open `.cursor/rules/principles.mdc` and replace the header comment to include the project name:
   Change: `# Project Design Principles`
   To: `# Project Design Principles — {project-name}`
2. This is the only file that needs project-name substitution at setup time. All knowledge files (`.spec/knowledge/*.md`) are generated fresh from scratch in Step 1b — they are not filled from templates.

---

#### Step 1b — Explore and build knowledge

Announce:
> "No project knowledge found. Building the knowledge base — this is a one-time setup. Future `/discover` calls will read from these files rather than re-exploring the codebase."

**Explore the codebase:**

1. Read the primary manifest (`package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml` / `pom.xml`) for tech stack and project purpose (already done in Step 1a — use those findings).
2. Read the project `README.md` for stated purpose, features, and setup instructions.
3. Scan the top-level folder structure to identify major domain areas.
4. For each major domain: scan key files to understand what they do. Read representative files — you do not need to read every file; scan names and a few dozen lines of the most important ones.
5. Look for CI/CD and infra files (`.github/workflows/`, `Jenkinsfile`, `Dockerfile`, `terraform/`, `k8s/`, `docker-compose.*`) for deployment knowledge.
6. Look for ADRs, architecture docs, or design decision records.

**Build these files in order:**

1. `knowledge/index.md` — master navigation page
2. `knowledge/overview.md` — project overview
3. `knowledge/deploy.md` — deployment knowledge
4. For each major domain identified: `knowledge/{domain}/README.md` — chapter navigation page, plus topic pages / subfolders as warranted by the split rules below

**Split into topic pages where warranted.** For each chapter, decide whether to keep it flat (just a README) or split it into topic pages. Use these rules:

- **Keep flat** when the chapter can be adequately covered in ~200 lines and no single topic within it is likely to be loaded independently across many tasks.
- **Split into topic pages** when: (a) covering the domain properly would push the chapter README past ~200 lines, OR (b) one of the topics clearly stands on its own — an agent working on a task touching that topic should be able to load just that page without loading the whole chapter.
- **Nest further (topic becomes a subfolder with its own README + sub-topics)** when a single topic itself is big enough to warrant the split — same rules apply recursively.

**Depth cap: 4 levels.** `knowledge/{chapter}/{topic}/{subtopic}.md` is the deepest without asking. If a chapter genuinely needs level 5, pause and ask the user:

> "Chapter `{domain}` needs deeper nesting than 4 levels to cover `{sub-topic-path}` properly. Proceed to level 5, or should we flatten this by splitting `{parent-topic}` into siblings instead? Alternatives: (a) go to level 5, (b) split parent into N siblings at level 4, (c) leave the extra detail out of the knowledge base."

**Style: document how it works, not what's broken.** Knowledge pages describe the current mechanism factually — data flow, function responsibilities, key file interactions. They do not editorialise about bugs, missing features, or improvements. When a task later reveals a problem, the agent should be able to plan the fix by understanding the current flow from the docs, not by having the fix pre-hinted in the knowledge base.

For a workflow, script, or non-trivial pipeline, the topic page should cover:
- **Inputs** — where data comes from, in what shape
- **Processing steps** — each transformation stage, in order, with the function that does it
- **Outputs** — what is written, where, in what format
- **External calls** — APIs, services, filesystem writes
- **Configuration** — env vars, config files it reads

Enough that an agent reading only that topic can trace end-to-end without opening any source file.

Announce when done:

> "✓ Prince Spec Kit initialized for **{project-name}**.
>
> Knowledge base built — {n} chapters created under `.spec/knowledge/`.
>
> Chapters:
> {list with one-line descriptions}
>
> **Next steps:**
> - Run `/start {description}` to begin a task or feature
> - Run `/discover --deep {domain}` to expand a chapter with detail pages
> - Open `.cursor/rules/principles.mdc` to add design principles for this project"

---

### Step 2 — Branch on prompt (when knowledge exists)

| Prompt | Action |
|--------|--------|
| `/discover` (no args) | Print a summary: chapter list, when each was last updated, any TBD sections flagged |
| `/discover --refresh` | Regenerate all knowledge from scratch |
| `/discover --refresh overview` | Regenerate `knowledge/overview.md` only |
| `/discover --refresh deploy` | Regenerate `knowledge/deploy.md` only |
| `/discover --refresh {domain}` | Regenerate that chapter's README and all its detail pages |
| `/discover --deep {domain}` | Add or expand detail pages for one chapter without modifying others |
| Knowledge question ("where is X?", "how does Y work?") | Answer from knowledge files. If a durable fact emerges that isn't yet documented, append a short note to the relevant page with a TBD marker if partially known. |
| Feature/task intent ("I want to build X") | Do not begin planning here. Say: "That sounds like a task — run `/start {description}` to plan it with knowledge context." |

---

## Output formats

### `knowledge/index.md` — master navigation

```markdown
# Project Knowledge Index — {repo name}
> Built: {ISO date} at SHA {sha} | Chapters: {n}

## What this project does
{2–3 sentences. Purpose, who uses it, the problem it solves.}

## Tech stack
{Key technologies, frameworks, languages. One line each.}

## Domain chapters

### {Chapter name}
`knowledge/{domain}/README.md`
{2–4 lines explaining what code lives in this chapter and when you'd read it.
Enough context to decide whether to open it for a given task.}

### {Chapter name}
...

## Cross-cutting architecture notes
{Facts that affect all chapters — auth model, error handling pattern, state management approach, etc.
These are the things that any agent working in any area needs to know.
Link to overview.md for depth.}

## Deployment
{One paragraph summary. See `knowledge/deploy.md` for full detail.}
```

### `knowledge/overview.md` — project overview

```markdown
# Project Overview — {repo name}
> Updated: {ISO date}

## Purpose
{What this project does and why it exists.}

## Repository structure
| Folder | Role |
|--------|------|
| `{folder}` | {what it is} |

## Tech stack
{Framework versions, key libraries, and where relevant: why they were chosen.}

## Architecture
{How the pieces fit together. Request/data flow. Key boundaries.
A simple ASCII or Mermaid diagram if helpful.}

## Key design decisions
{Decisions that shape how new work is done.
Summarise ADRs if they exist, with links to source files.}

## Conventions
{Naming, file organization, coding patterns in use. Examples > prose.}

## Testing
{Framework, where tests live, how to run locally, what's mocked vs real.}

## Glossary
{Domain terms and abbreviations used in the codebase.}
```

### `knowledge/deploy.md` — deployment knowledge

```markdown
# Deployment Knowledge — {repo name}
> Updated: {ISO date}

## Environments
{dev / staging / prod and how they differ.}

## CI/CD pipeline
{How code travels from branch to production. Key stages.}

## Build
{How the artifact is produced. Command to build locally.}

## Infrastructure
{Hosting, containers, serverless, cloud services — what runs where.}

## Configuration and secrets
{Where environment variables come from. Secrets management approach.
Names of key variables but never their values.}

## Deploy steps
{What a typical deploy looks like. Manual gates if any.}

## Rollback
{How to revert when something goes wrong.}

## Monitoring
{Dashboards, alert thresholds, where to look when something breaks.}
```

### `knowledge/{domain}/README.md` — chapter navigation

```markdown
# {Domain Name} — Chapter Overview
> Updated: {ISO date}

## What this chapter covers
{2–3 sentences. What code lives here. When an agent would read this chapter.}

## Key files
| File | Role |
|------|------|
| `{path}` | {what it does} |

## Topics in this chapter
{Populate this section when topic pages exist. Each topic is a link with a one-line description
so an agent can decide which topics to open without reading them all.}

| Topic | Covers |
|-------|--------|
| [`{topic}.md`](./{topic}.md) | {one line} |
| [`{topic-with-subtree}/README.md`](./{topic-with-subtree}/README.md) | {one line — this topic is itself a folder with sub-topics} |

{If no topic pages exist, write:
"No topic pages yet. This chapter is currently flat — run `/discover --deep {domain}` to expand."}

## Patterns
{How code in this domain is typically structured. A short representative example is more useful than prose.}

## Common gotchas
{Things that trip people up when working in this area. Factual, not editorialised.}

## Related chapters
{Other chapters this one interacts with closely.}
```

### `knowledge/{domain}/{topic}.md` — topic page

```markdown
# {Topic Name}
> Updated: {ISO date}

## What this topic covers
{2–3 sentences. Scope of this topic within the chapter.}

## Key files
| File | Role |
|------|------|
| `{path}` | {what it does} |

## How it works
{The mechanism, end-to-end. For a pipeline: inputs → processing steps → outputs.
For a subsystem: entry points → responsibilities → external calls.
Enough that an agent reading only this page can trace behaviour without opening source.}

## Configuration
{Env vars, config files, feature flags this topic reads or writes.}

## Common gotchas
{Factual observations, not editorial. "The Fuse index is rebuilt on every add" is useful.
"Ordering could break here" is not — that's editorialising a fix.}

## Related topics
{Other topics/chapters this interacts with.}
```

### `knowledge/{domain}/{topic}/README.md` — topic-as-folder navigation

When a topic itself is big enough to warrant its own subfolder, its `README.md` follows the chapter README format above (adjusted for scope) and lists sub-topics. Same rules apply recursively up to the 4-level cap.

---

## Brownfield honesty rule

Brownfield codebases have gaps: undocumented decisions, legacy code that conflicts with the stated architecture, areas that weren't explored during the build.

**Document what you observe, not what you assume.**

Mark gaps explicitly rather than filling them with guesses:

```markdown
> ⚠️ TBD — Auth mechanism observed in `middleware/auth.ts` but full flow not traced. Verify before working in this area.
```

A visible gap is more useful than a confident wrong answer. Agents working later will know to verify before acting.

---

## Coverage standard

After a first-time build, a developer should be able to answer all of these from the knowledge files alone — without `grep` or codebase exploration:

- What does this project do? Who uses it?
- Where does a typical request, handler, or component live? What's its structure?
- How is auth handled? Logging? Error handling?
- What external services are called, and how?
- How are tests organized? How do I run them?
- How is the artifact built and deployed? How do I roll back?
- What domain terms are in use?
- For any non-trivial pipeline, workflow, or subsystem: what is the end-to-end flow from input to output, including which function does each step and what external calls happen along the way?

If any of these still requires codebase exploration, flag the gap as TBD — don't publish thin sections that give false confidence.

Split-depth self-check: if a chapter README is under ~80 lines despite the domain being large, or over ~200 lines with no topic pages, the split decisions probably need revisiting.
