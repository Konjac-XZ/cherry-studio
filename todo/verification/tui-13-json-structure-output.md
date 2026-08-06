# TUI-13/TUI-14 Structured JSON Output Boundary

Status: full parser, renderer, copy, Preference, page, and settings boundary `verified` on
2026-08-06 (Asia/Shanghai).

## Implemented boundary

- Added a renderer-only parser that accepts an object/array root or one standalone JSON/JSONC/JSON5
  fence, removes the narrowly scoped copied-property wrapper, tries native `JSON.parse` first, and
  then applies formatter-quote normalization plus `jsonrepair`.
- Rejects scalar roots, prefixed explanations, trailing explanations, multiple roots/fences, and
  nested fences before tolerant repair can reinterpret them.
- Exposes structured data only when the feature is enabled and translation has completed.
- Added a fully expanded Tailwind-based hierarchy view with nonshrinking keys capped at 30%/280px,
  wrapping values, semantic type colors, decoded string display, and safe React text rendering.
- Added pure selection-copy normalization for all four separator modes and the optional blank row;
  newline-bearing key/value separators are not doubled.
- Integrated the view into `TranslateOutputPane` behind optional, default-off props. Structured JSON
  takes precedence over Markdown only when explicitly enabled. Existing full-copy, history, cache,
  and export handlers continue to receive the authoritative raw translation string.
- Added `jsonrepair@3.13.1`, matching the source implementation's tolerant-repair dependency.

## Verification

- Focused renderer tests: 4 files, 21 tests passed.
  - parser strict/repair/root/fence/trailing-content/completion contracts;
  - four separators, CRLF preservation, blank-row behavior, and no-op selections;
  - decoded/safe hierarchy rendering and local clipboard-event override;
  - output JSON precedence and streaming fallback.
- `pnpm typecheck:web` — passed.
- Focused Biome write/check over the implementation and tests — passed.
- Focused Oxlint and ESLint over the implementation and tests — passed with zero warnings/errors.
- `git diff --check` — passed for the shared worktree.

## Completed activation

- The three generated Preference values are bound by TranslatePage and forwarded to
  TranslateOutputPane/JsonStructureView.
- TranslateSettings exposes the dedicated JSON card, retains separator/blank-row values while the
  view is disabled, and reports persistence failures through the shared rollback path.
- Full repository lint/test/build and interactive Electron drag-selection verification remain final
  acceptance work; this focused record covers automated behavior only.
