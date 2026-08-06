# Repository, Build, Maintenance, and V2-Native Dispositions

Status: `verified`; source dispositions, implementation, and the final R01 installer artifact gate
are complete.

Every item here must receive an explicit final disposition. `noise` means no product behavior is
being silently dropped; it does not mean the source path is excluded from coverage accounting.

## R01 — Personal Windows x64 installer workflow

- Source: `b6e05a00e6`, `ab2a83cba4`; `package.json`, `scripts/build-win-x64.js`.
- Required:
  - `build:win:x64` invokes the personal script;
  - prepend local `node_modules/.bin`;
  - disable certificate discovery and Cherry/CSC signing variables;
  - build, then Electron Builder Windows NSIS x64;
  - use `nsis.packElevateHelper=false` and `compression=store` for the local build;
  - delete only older resolved `dist/Cherry-Studio-*-x64-setup.exe` files and preserve the current
    version artifact.
- V2 adaptation: use current pnpm/build commands and artifact names. Unsigned local success is not
  release-signing validation.
- Acceptance: final goal must record the absolute installer path, size and hash.
- Status: `verified` on 2026-08-06. The V2-native script uses pnpm, local binaries, unsigned
  environment isolation, NSIS x64/store compression, and resolved dist-only old-installer cleanup.
  The successful artifact's absolute path, size, timestamp, and SHA-256 are recorded in
  `todo/verification/windows-x64-installer.md`.

## R02 — Personal CI/workflow suppression

The final V1 endpoint deletes these upstream workflows; V2 currently has them:

- `.github/workflows/claude-code-review.yml`
- `.github/workflows/claude.yml`
- `.github/workflows/dispatch-docs-update.yml`
- `.github/workflows/issue-management.yml`

Personal-branch intent is to keep them disabled/absent. Treat and verify each file independently.
Historical upstream-sync workflow iterations are `retired`; the workflow is absent at both final
V1 endpoints and has no runtime artifact to port.

Status: `verified` on 2026-08-06. All four current V2 workflow files are removed independently; no
other CI or test workflow was suppressed.

## R03 — Repository hygiene and local instructions

- `.gitignore`: retain useful ignores for generated `electron.vite.config.*.mjs`, `.serena`, `.tmp`.
- `AGENTS.md`: retain the personal-branch compatibility note while respecting the V2 repository's
  current guidance.
- `CLAUDE.md`: do not copy stale or contradictory package-manager edits.
- `.vscode/settings.json`: optional personal editor configuration; no product behavior.
- `.serena/project.yml` and generated timestamp config: removed/no final artifact.
- `MIGRATION_BEHAVIOR_TEST_MATRIX.md`: evidence imported into `todo/inventory/`; not runtime code.
- Status: `verified` on 2026-08-06. The V2 instruction files remain authoritative with the
  personal-branch note inherited from the source workspace. Only useful generated-config,
  `.serena`, and `.tmp` ignores were added; stale CLAUDE/editor/generated artifacts were not copied.

## R04 — Test-suite integrity

The V1 endpoint excludes CherryClaw tests by default and comments out individual builtin-skill and
non-Windows background-material tests. Do not reproduce these suppressions merely to pass the V2
acceptance gate. Port only after reproducing a still-relevant V2 defect and documenting it; otherwise
use V2's full configured suites.

Status: `verified` no-port on 2026-08-06. No V2 test exclusion or per-test suppression was copied;
the final acceptance uses V2's configured suites and will report genuine baseline failures.

## R05 — Maintenance-only source differences

Explicitly audit and normally classify as V2-native/obsolete/no-port:

- Ollama embedding constructor type assertions (`8bb06f4705`): compile-only workaround.
- Direct `pdf-parse` import (`878b0c0d8a`): only if the V2 loader reproduces the problem.
- Example API endpoints in tests (`4fdb0bde32`): test hygiene only.
- Removed unused QuickModel provider override (`7cc13b86c8`): no feature behavior.
- Removed imports (`9a54f5c3ff`, `30f1c8b122`): no feature behavior.
- Generated config artifact deletion (`1881abde16`): covered by R03.
- `electron-builder.yml` native unpacking: belongs to clipboard-watcher packaging, not general
  release policy.
- Topic-switch timing instrumentation in old `useTopic.ts` and language-option/unknown-lookup
  diagnostics in old `useTranslate.ts`: diagnostic-only endpoint regions. Default disposition is
  no-port unless current V2 diagnosis shows equivalent observability is still needed.

Status: `verified` dispositions on 2026-08-06. Compile-only/import/removal/test-fixture differences
remain no-port because current V2 typecheck and focused owners do not reproduce their old defects.
Diagnostic-only timing/logging regions remain no-port. Clipboard-event native unpacking is retained
under TC-11/R01; all product behaviors in the list are owned by their explicit tasks.

## V2-native equivalents that still require verification

- Custom language CRUD and migration: native DataApi/main SQLite implementation.
- Basic Translate streaming/cancellation, file processing, typed IPC, history CRUD/star/delete and
  language database: native foundations, not equivalence for the missing custom behaviors.
- Zhipu painting default: native.
- CherryAI/local-embedding provider-settings visibility: partial native policy.
- Claude Sonnet 5: mostly native; see N14.
- Gemini budget-dialect zero thinking budget: native; Gemini 3 off differs, see N12.
- V2 topic delete confirmation and modifier fast delete: native foundation; middle-click still N07.
- V2 command registry/lifecycle/data systems: architectural targets, not feature equivalence.

## Explicit upstream-divergence/dead-code no-port bucket

- `useUnifiedGrouping.ts`: present in the final old endpoint but unused; no caller found.
- `ThinkingEffect.tsx` padding/height: upstream divergence rather than personal behavior.
- `HomePage.tsx` `useAgentSessionInitializer`: upstream divergence.
- Model/app PNG and country-flag binary drift: upstream/asset drift unless required by an explicit
  feature entry.
- `Messages.tsx` clear-confirm modal removal: no personal behavior provenance found.
- Broad provider/list-model/options/schema changes: translation request plumbing or upstream API
  evolution; only their behavior contracts are ported.
- `dedicatedImage.ts`, `modelCapabilities.ts` import reshuffles: capability refactor support, not a
  separate feature.
- Obsolete default export added to old `OvmsManager`: do not port.

Each entry remains represented in `source-path-coverage.md`; final re-audit must confirm that no live
caller or personal behavior contradicts these dispositions.
