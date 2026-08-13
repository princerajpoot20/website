# Case studies, finance, and use cases
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

Three smaller generators that all read source content from `config/` (or `pages/`) and produce companion JSON files at build time.

## Key files

| File | Role |
|------|------|
| `scripts/casestudies/index.ts` | `buildCaseStudiesList(dirWithCaseStudy, writeFilePath)` |
| `scripts/casestudies/schema.json` | Shape for case-study YAMLs |
| `scripts/casestudies/casestudy_template.yml` | Contributor template for a new case study |
| `scripts/finance/index.ts` | `buildFinanceInfoList({ currentDir, configDir, financeDir, year, jsonDataDir })` |
| `scripts/usecases/index.ts` | `buildUsecasesList()` |
| `config/casestudies/*.yml` | Source case-study files |
| `config/finance/{year}/Expenses.yml`, `ExpensesLink.yml` | Yearly finance source data |
| `config/finance/json-data/` | Output JSON (per-year, latest only) |
| `config/case-studies.json` | Output for the frontend |

## How each works

### Case studies (`scripts/casestudies/index.ts`)

`buildCaseStudiesList(dirWithCaseStudy, writeFilePath)`:
1. `readdir(dirWithCaseStudy)` — lists every file in the directory
2. `Promise.all(files.map(...))` — reads each file and converts via `convertToJson` (from `scripts/helpers/utils`), which parses YAML or JSON transparently
3. `writeFile(writeFilePath, JSON.stringify(caseStudiesList))` — one array containing every case study, in the order `readdir` returned

No sort, no filter, no validation in the generator itself. The `validate-case-studies-structures.yaml` workflow enforces shape separately (see `../workflows/quality-and-testing.md`).

### Finance (`scripts/finance/index.ts`)

`buildFinanceInfoList({ currentDir, configDir, financeDir, year, jsonDataDir })`:
1. Resolves paths to `Expenses.yml` and `ExpensesLink.yml` under `config/finance/{year}/`
2. `Promise.all([access(x, F_OK), access(y, F_OK)])` — verifies both files exist (F_OK check)
3. `mkdir(jsonDirectory, { recursive: true })` — ensures `config/finance/json-data/` exists
4. `writeJSON(expensesPath, expensesJsonPath)` (from `helpers/readAndWriteJson.ts`) — parses YAML, writes JSON
5. Same for `ExpensesLink.yml`

The `year` argument is chosen by the caller. `scripts/index.ts::start` picks the latest year:
```typescript
const yearsList = fs.readdirSync(financeDir)
  .filter(file => !Number.isNaN(parseFloat(file)))
  .sort((a, b) => parseFloat(b) - parseFloat(a));
if (yearsList.length === 0) throw new Error('No finance data found...');
const latestYear = yearsList[0];
```

So only the latest year's expenses ever end up in `config/finance/json-data/`. Historical years remain as YAML under `config/finance/{year}/` but are not re-generated to JSON.

### Use cases (`scripts/usecases/index.ts`)

`buildUsecasesList()` compiles the use-cases list. Invoked with no arguments; reads from a fixed relative path and writes to a fixed output.

## Configuration

| Argument / var | Purpose |
|---|---|
| Case studies `dirWithCaseStudy` | Set to `config/casestudies` in `scripts/index.ts` |
| Case studies `writeFilePath` | `config/case-studies.json` |
| Finance directory | `config/finance/` |
| Finance year | Latest numeric subdirectory |

## Common gotchas

- **Case studies output order matches `readdir`** — the frontend applies its own client-side ordering when it needs a specific display sequence.
- **Case study validation lives elsewhere.** The generator does not validate against `schema.json`. The workflow does, or fails fast.
- **Finance only builds the latest year.** Historical data in JSON form is *not* regenerated. If historical schemas change, they must be re-run manually.
- **`writeJSON` helper** silently returns without writing if the source file is missing. `access(..., F_OK)` upstream is the only gate.
- **YAML files with `.yml` extension only** — `.yaml` is not enumerated by the finance path resolution.

## Related topics
- [`README.md`](./README.md) — parent chapter
- `../workflows/quality-and-testing.md` — case-study structure validation workflow
