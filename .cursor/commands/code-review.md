# /code-review

Review a pull request and produce structured, copy-paste-ready review comments — each with a specific concern, a concrete suggestion, and an explanation the author can use to understand the why.

Designed for maintainers: review in Cursor, paste comments into GitHub, discuss directly from context.

---

## Input

| Input | How it's processed |
|-------|-------------------|
| GitHub PR URL (`https://github.com/org/repo/pull/123`) | Fetches PR files and diff via GitHub MCP tool |
| Branch name (`feature/add-valid-chip`) | Runs `gh pr diff {branch}` if a PR exists, or `git diff main...{branch}` for a local branch |
| No input | Ask: "Provide a PR URL or a branch name to review." |

If the diff is very large (> 400 lines changed), ask before proceeding:
> "This PR has {n} lines of changes. Review the whole thing, or focus on a specific area? (Provide file paths or describe the area.)"

---

## Behavior

### Step 1 — Get the diff

**PR URL:** Use the GitHub MCP tool. Fetch PR metadata (title, description, base/head branches) and the file diff.

**Branch name:** First try `gh pr diff {branch}`. If no PR exists, use `git diff main...{branch}`.

Extract: list of changed files, the diff content, and the PR description (if available).

### Step 2 — Load knowledge context

Read `knowledge/index.md`. Identify which chapters are relevant to the changed files.

Load those chapter README files. Load detail pages if the changes touch a well-documented specific area.

If no knowledge exists (`.spec/knowledge/` not found): proceed without it, but note in the review:
> "Note: No project knowledge base found. Review is based on the code diff alone. Run `/discover` to build project context for future reviews."

### Step 3 — Analyse the diff

Go through changed files systematically. For each meaningful change, evaluate:

- **Correctness** — does the logic actually do what it's intended to do?
- **Architecture** — does this follow the patterns established in the codebase (as documented in knowledge)?
- **Edge cases** — what inputs or states does this change not handle?
- **Tests** — does the change have appropriate test coverage? Are existing tests still valid?
- **Security** — any obvious security concerns (injection, auth bypass, data exposure)?
- **Performance** — any obvious performance concerns for the scale this project operates at?
- **Documentation** — are comments, types, or docs outdated or missing?

### Step 4 — Produce the review

---

## Output format

```markdown
## Code Review — {PR title or branch} — {date}

### Overall assessment

**Verdict:** Approve ✅ | Request changes 🔄 | Comment only 💬

{2–3 sentences: what this PR does, the overall quality, and one key observation about the approach.}

---

### Comments

**`{filepath}:{line}`** — [{Bug | Architecture | Style | Test | Security | Performance | Docs}]
> `{exact line(s) from the diff — 1–3 lines max}`

**Concern:** {What is wrong and why it matters — specific, not generic. "This can return undefined when X" not "this might have issues."}

**Suggestion:** {What to do instead. Include a short code example if it makes the suggestion clearer.}

**Explanation:** {Context for the maintainer — why this matters in this codebase, what pattern it conflicts with, what could break, or what the user impact is. Omit if the concern is self-evident.}

---

{Repeat per comment. Group by file if there are many comments on one file.}

---

### Positive notes

{Things done well. Optional but valuable — highlights good decisions, calls out patterns done right, acknowledges effort.}

---

### Must fix before merging

- {Item from comments above that blocks approval}
- {Item}

### Nice to have (non-blocking)

- {Lower-priority suggestion from comments above}
```

---

## Review principles

**Be specific.** "This breaks when `document` is null because `documents.state.ts` only populates after the parser runs" — not "this could cause issues."

**Cite the knowledge base.** If a comment is about a convention, mention the knowledge page that documents it: "Per `knowledge/state/README.md`, all persistent state goes through Zustand stores — this local useState breaks that pattern."

**Separate blocking from non-blocking.** The "Must fix" and "Nice to have" sections make it easy for the author to prioritise.

**Explain the why.** Even if the maintainer agrees with the fix, an explanation makes the comment educational. Future reviewers and authors will learn from it.

**Don't flag what the linter catches.** Only raise style issues that automated tooling won't catch.

**Be fair about context.** If a pattern exists elsewhere in the codebase that isn't ideal, note it as a pre-existing issue rather than blocking this PR for it.

---

## After the review

Print:
> "Review complete. {n} comments ({blocking} blocking, {non-blocking} non-blocking).
>
> Comments are formatted for direct paste into GitHub. Copy each comment block as-is into the GitHub review interface."
