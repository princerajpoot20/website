# /complete

Archive a completed work item, update the project knowledge with anything learned during implementation, and maintain the traceability index.

Run this when implementation is done and you're ready to close the work item.

---

## Behavior

### Step 1 — Find the active work item

**CRITICAL — use a real filesystem list, not `git status`.** The `.spec/work/active/` directory is intentionally gitignored (it holds WIP planning, not tracked source), so `git status`, `git ls-files`, and any git-based lookup will show it as empty EVEN WHEN WORK ITEMS EXIST.

Run a direct filesystem listing. In Cursor use the file-listing / directory-read tool. If forced to use a shell, use `ls .spec/work/active/` or `find .spec/work/active -maxdepth 1 -type f -name '*.md'` — never `git status` or `git ls-files`.

Then branch on how many `.md` files are present:

- **One file found** → use it automatically. Read the whole file into context.
- **Multiple files found** → ask: "Which work item are you completing? Found: {list of IDs}. Reply with one ID, or say `all` to complete each in sequence."
- **No files found** — before concluding "no active work items", double-check with a second listing method (e.g. `ls -la .spec/work/active/` to reveal any dotfiles or hidden files). Only if the second check also returns empty, say:
  > "No active work items found in `.spec/work/active/`. Did you mean to run `/start` to begin something new? If you believe a work item should exist, verify with `ls .spec/work/active/` in your terminal — the directory is gitignored, so `git status` won't show it."

Read the selected work item into context before continuing to Step 2.

### Step 2 — Capture what actually happened

Before asking anything, inspect the implementation independently — run `git status` and `git diff` on tracked source files (this is fine here — we're inspecting source, not the gitignored planning dir) to see what actually changed on disk.

Compare against the work item's `Implementation plan` and `Files to change` sections. Then ask (user can answer in one message):

> "Before archiving, three quick questions:
> 1. **Completion status** — is this work item fully done, or was only part of the plan implemented? If partial, tell me which steps are complete and which are deferred.
> 2. **Deviations from the plan** — did the implementation differ from the plan? Different files touched, approach changes, unexpected complexity?
> 3. **Knowledge updates** — did you discover anything about the codebase worth adding to the knowledge base? (New patterns, undocumented behaviours, architectural facts you had to uncover manually.)"

**STOP. Wait for the user's response before proceeding.**

Based on the answer to question 1, choose an archive path:

- **Fully complete** → proceed to Steps 3–7 as normal (full archive + knowledge update + delete active item).
- **Partial completion** → jump to the "Partial completion" branch below (do NOT delete the active item; append a `Remaining work` section instead).

### Step 3 — Update the knowledge base

If the user identified knowledge updates in Step 2:

1. Open the relevant `knowledge/` pages
2. Update or append only the specific sections that changed — do not restructure the whole page
3. At the bottom of every updated section, add a traceability note:
   ```
   > Updated by: [{id}](../../work/archive/{id}.md) — {ISO date}
   ```
   For minimal/small items archived to `completed-tasks.md`:
   ```
   > Updated by: [{id}](../../work/archive/completed-tasks.md#{id}) — {ISO date}
   ```

If no updates needed, note this and move on.

### Step 4 — Archive the work item

**Assess final complexity** (based on what was actually done — may differ from initial assessment):

---

**Minimal or small → append to `work/archive/completed-tasks.md`:**

```markdown
---

## {id}
**Completed:** {ISO date} | **Type:** fix | improvement | feature | **Files changed:** {n}

{2–3 sentences: what was built or fixed, the key decision made, and what it cost to figure out — especially if it differed from the plan.}

**Files changed:** `{file1}`, `{file2}`
**Knowledge updated:** {Yes — see `knowledge/{path}` | No}
```

---

**Medium or large → create `work/archive/{id}.md`:**

```markdown
# {id}
**Completed:** {ISO date}
**Type:** fix | improvement | feature
**Complexity:** {final level}
**Files changed:** {n}

---

## What was built
{Summary of the implementation — what exists now that didn't before.}

## How it works
{Key implementation detail worth preserving for future maintainers.}

## Key decisions
{Architectural or design decisions made during implementation. Why those choices.}

## What we learned
{Anything discovered about the codebase during implementation — especially things not in the knowledge base that should now be there.}

## Files changed
| File | What changed |
|------|-------------|
| `{path}` | {change} |

## Knowledge pages updated
{Links to knowledge pages updated by this work, and what changed in each. "None" if nothing updated.}
```

---

### Step 5 — Update the archive index

Open `work/archive/README.md` and add a row to the table:

| Date | Type | Title | Summary | Detail |
|------|------|-------|---------|--------|

Where the Detail link points to:
- `./work/archive/{id}.md` for medium/large items
- `./work/archive/completed-tasks.md#{id}` for minimal/small items (anchor by ID)

### Step 6 — Remove the active work item

Delete `.spec/work/active/{id}.md`.

### Step 7 — Print completion summary

```
Done. {id} archived.

├── Archive: work/archive/{location}
├── Index: work/archive/README.md updated
└── Knowledge: {[list of pages updated] | no updates}
```

---

## Partial completion branch

Use this branch when Step 2's answer is "partial" — some plan steps done, others deferred.

### P1 — Update the active work item in place (do NOT archive, do NOT delete)

Open `.spec/work/active/{id}.md` and append two sections at the end:

```markdown
---

## Progress log
- **{ISO date}** — Partial `/complete` run. Completed: {steps N, M}. Deferred: {steps X, Y}.

## Remaining work
{Concrete list of what is still to do, taken from the deferred plan steps.
Include any new context discovered so the next resumption doesn't have to re-figure it out.}
```

If a `## Progress log` section already exists from a previous partial completion, append the new entry as an additional bullet — do not overwrite.

### P2 — Update knowledge if the user identified anything worth capturing

Same rules as Step 3 of the normal path. Traceability note pointing to the active item this time (not archive), because it isn't archived yet:

```
> Updated by (partial): [`work/active/{id}`](../../work/active/{id}.md) — {ISO date}
```

### P3 — Print partial-completion summary

```
Partial /complete recorded for {id}.

├── Work item: work/active/{id}.md (kept open, progress log updated)
├── Completed steps: {N, M, ...}
├── Deferred steps: {X, Y, ...}
├── Knowledge: {[list of pages updated] | no updates this pass}
└── Next: pick up where left off, or run /complete again when the deferred steps are done.
```

**Do not delete the active work item. Do not add it to the archive index yet.** The item is still open — it will be fully archived on a future `/complete` when the user confirms all steps are done.
