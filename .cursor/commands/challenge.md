# /challenge

Stress-test the current implementation plan before a line of code is written. Surface risks, edge cases, conflicts, and gaps systematically — across six dimensions.

Run after `/start` produces a plan, especially for medium and large items. Also useful mid-implementation if the plan feels shakier than expected.

---

## Behavior

### Step 1 — Find the active work item

Read `.spec/work/active/`. If multiple, ask which to challenge. Read the work item.

Reload any referenced knowledge pages if they're not already in context (they usually are from `/start`).

### Step 2 — Run the challenge across six dimensions

For each dimension: find concerns. If a dimension has none, say so briefly — don't omit it.

---

**Dimension 1: Assumption risks**

Every plan assumes things to be true. Name each assumption. For each one, ask: what breaks in the implementation, the test, or the user experience if this assumption is wrong?

Pay attention to assumptions about:
- How existing code works
- What the user's intent is
- What edge states are reachable
- What external systems will do

---

**Dimension 2: Missing edge cases**

What inputs, states, or sequences does the plan not account for? Focus on:
- Empty or null states
- Concurrent or rapid-repeat actions
- Invalid or unexpected input formats
- Users doing something the plan assumes they won't
- Events that arrive out of order
- Large data or slow operations

---

**Dimension 3: Knowledge conflicts**

Cross-reference the plan against the referenced knowledge pages.

- Does the plan contradict a documented convention or pattern?
- Does it modify something the knowledge marks as a design constraint or TBD?
- Does it introduce a pattern not used elsewhere in this codebase?
- Are there files marked as important in the knowledge that the plan doesn't touch — but probably should?

---

**Dimension 4: Test gaps**

Look at the success criteria and implementation steps.

- What parts of the implementation have no way to verify they work?
- Which integration points are assumed to work without testing?
- What behavioral changes could silently break without a failing test?
- Is the success criteria specific enough to know when the work is actually done?

---

**Dimension 5: Scope and complexity**

- Is the stated complexity (`minimal` / `small` / `medium` / `large`) accurate given what the plan actually describes?
- Are there hidden follow-on effects — other parts of the codebase that this change will implicitly affect?
- Does "Step N" in the plan hide significant unexplored work?
- Is there post-implementation cleanup, migration, or documentation that wasn't included?

---

**Dimension 6: Simpler alternatives**

- Is there a simpler approach that achieves the same outcome?
- Does the plan use a new mechanism where an existing one would work?
- Is the design more general than it needs to be for this specific task?

Note alternatives — don't reject the plan. The developer chooses.

---

### Step 3 — Produce the challenge report

Do not revise the work item. Present findings only.

---

## Output format

```markdown
# Challenge Report — {work item id}
**Date:** {ISO date}

---

## Findings

### 1. Assumption risks
{Finding — [High | Medium | Low] — description of risk and what breaks if the assumption is wrong}
{Or: "None identified."}

### 2. Missing edge cases
{Finding — description}
{Or: "None identified."}

### 3. Knowledge conflicts
{Finding — what the plan does vs what the knowledge says}
{Or: "None identified — plan is consistent with documented patterns."}

### 4. Test gaps
{Finding — what's not being tested and why it matters}
{Or: "Success criteria are sufficiently specific and testable."}

### 5. Scope and complexity
{Assessment of complexity accuracy and any hidden scope}
{Or: "Complexity assessment looks accurate."}

### 6. Simpler alternatives
{Alternative approach if one exists — describe it briefly}
{Or: "Current approach is appropriate for this scope."}

---

## Before implementing — address these

{Prioritised list of the items above that should be resolved before writing code.
Be specific: "Clarify whether X can be null before assuming it isn't in Step 2."}

## Can be addressed post-implementation

{Lower-priority items that are acceptable to handle later — tech debt to log, tests to add in a follow-up, etc.}
```

---

## After the report

Print:
> "Challenge complete. If you're addressing findings above, update `.spec/work/active/{id}.md` with the revised approach before proceeding.
>
> When implementation is done, run `/complete` to archive this work item."

**Do not begin implementation. Do not modify the work item.** The developer reads the report and decides what to change.
