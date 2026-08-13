# /start

Begin a new task or feature. Takes your raw description — however rough or unfurnished — and guides you through scoping, asking the right questions, and producing a concrete implementation plan.

This is the daily-use command. Use it for anything: a small bug fix, an improvement to existing behavior, or a large new feature. The depth scales to the complexity of the work.

---

## Behavior

### Step 1 — Knowledge check

Read `knowledge/index.md`.

If it doesn't exist, stop and say:
> "No project knowledge found. Run `/discover` first to build the knowledge base. This ensures the plan is grounded in how your codebase actually works."

### Step 2 — Identify relevant chapters

From the user's description and the index, identify which domain chapters are relevant to this work.

Load only those chapter `README.md` files. Do not load chapters that are clearly unrelated.

If relevance is genuinely ambiguous, load the most likely chapter and state your assumption:
> "Loading the Editor chapter — let me know if this work touches another area too."

### Step 3 — Load detail pages (if needed)

From the chapter README files, identify whether any specific detail pages are needed for this work.

Load only those pages. If the chapter README gives enough context, do not load detail pages.

### Step 4 — Clarify before planning

Review what you now understand. If anything is unclear or ambiguous — scope, intent, constraints, expected behavior, design direction — ask questions now.

**Rules for this step:**
- Ask no more than 4 questions at a time
- Make questions specific and actionable: "Should this chip appear in the editor header or in the status bar?" — not "Where should the UI go?"
- If an answer seems obvious from the context, state your assumption instead: "I'll assume X — correct me if wrong."
- If the description is clearly complete and unambiguous, skip this step entirely.

**STOP. Wait for the user's answers before writing the plan.**

### Step 5 — Write the work item

Once you have enough context, create `.spec/work/active/{id}.md`.

Derive the `{id}` from the description as a kebab-case identifier (e.g. `add-valid-status-chip`). Suggest the ID in your output — don't ask for confirmation unless it's genuinely ambiguous.

**Important — the work item is persistent state, not chat-scoped.** The file lives on disk under `.spec/work/active/{id}.md` and stays there until an explicit `/complete` (fully done) or a partial `/complete` (leaves it in place with a Remaining-work section appended). It does NOT get auto-deleted after implementation. It survives across chat sessions and Cursor restarts.

Note that `.spec/work/active/` is gitignored by design — do not confuse the absence-from-`git status` with the file being missing. Always verify with a filesystem list (`ls .spec/work/active/`), not with git.

**Self-assess complexity:**

| Level | Meaning |
|-------|---------|
| `minimal` | 1 file, simple change, < 30 min, no new patterns |
| `small` | 2–3 files, uses existing patterns, < 2 hours |
| `medium` | 3–8 files, crosses 2+ domains, 2–8 hours |
| `large` | Many files, architectural decisions required, > 1 day |

**Print after creating the file:**
> "Work item created at `.spec/work/active/{id}.md`. Complexity: **{level}**.
>
> **To move forward, choose one:**
> - Say **`proceed`** (or `go`, `implement it`, `looks good`) — I'll implement the plan as written
> - Say **`/challenge`** — stress-test the plan first (recommended for medium/large)
> - Edit the work item file directly with any changes, then say `proceed`
>
> I will not write any code until you say to proceed.
>
> When implementation is done, run **`/complete`** to archive the work and update the knowledge base."

**Do not write any code in this step. Do not begin implementation. Wait for the user to say `proceed` (or an equivalent phrase like `go`, `implement`, `yes`, `looks good`) before beginning implementation.**

---

## Work item shape

The file created at `.spec/work/active/{id}.md`:

```markdown
# {id}
**Date:** {ISO date}
**Type:** fix | improvement | feature
**Complexity:** minimal | small | medium | large

---

## Summary
{The work in clear, precise language. Better than the user's original description — but faithful to their intent. Include what is NOT in scope if that's important to capture.}

## Why
{What problem does this solve? What does it improve? Why now?}

## Knowledge referenced
{List of knowledge files read to produce this plan, and what each told you that shaped the plan.}
- `knowledge/{chapter}/README.md` — {what you learned from it}
- `knowledge/{chapter}/{topic}.md` — {specific fact used}

## Open questions and answers
{Questions asked in Step 4, with the user's answers inline. Skip this section if no questions were needed.}

Q: {question}
A: {answer}

## Design approach
{How this will be implemented. Key decisions and the reasoning behind them.
If you considered and rejected alternatives, note that here briefly.}

## Implementation plan
1. {Concrete step — specific enough to act on without re-reading knowledge}
2. {Concrete step}
3. ...

Each step should name the file(s) being changed and what changes.

## Risks and edge cases
- {What could go wrong or be missed}

## Success criteria
- {How we know the work is done and correct}

## Files to change
| File | Change |
|------|--------|
| `{path}` | {what will change} |
```

---

## After creating the work item

**For `large` complexity:** Strongly recommend `/challenge`:
> "This is a large item. Running `/challenge` before starting implementation is strongly recommended to surface any design gaps."

**For `medium` complexity:** Note that `/challenge` is available:
> "Medium complexity. Consider running `/challenge` if you're uncertain about the approach."

**For `minimal` or `small`:** No special action needed. Just note that `/challenge` is available.
