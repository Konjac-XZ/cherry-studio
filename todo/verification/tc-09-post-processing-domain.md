# TC-09 Translation Post-Processing Domain

Status: pure utility boundary `verified` on 2026-08-06 (Asia/Shanghai).

## Implemented boundary

- Pure ordered pipeline with a master gate and independent Chinese smart-quote, Chinese/Latin
  spacing, English straight-quote, and regex stages.
- Chinese smart quotes run before spacing; sequential regex rules run last.
- Language and Markdown gates retain the V1 behavior: smart Chinese quotes only for `zh-cn`,
  Chinese spacing for `zh-cn`/`zh-tw`, and English straight quotes for the primary `en` language.
- Quote semantics retain nested punctuation, apostrophe, and measurement-prime handling.
- Markdown parsing protects fenced/inline code, math, HTML, link destinations, autolinks, URLs,
  filesystem paths, leading frontmatter, and structured JSON/YAML/shell-like text.
- Chinese spacing preserves Markdown structure and protects opaque inline atoms, compact slash
  compounds, file extensions, and hyphenated identifiers.
- Disabled rules, empty rule sets, invalid patterns, and invalid flags are isolated; one bad regex
  cannot discard prior output or prevent a later valid rule.
- The API lives at `src/renderer/utils/translate/` because the current consumers are renderer-side;
  it is stateless and reusable by Translate and later assistant automation without speculative
  placement in the cross-process shared layer.

## Verification

- Focused renderer Vitest: 3 files, 27 tests passed.
- `pnpm typecheck:web` — passed.
- Focused Biome format/check — passed after formatting the new utility and test files.
- `git diff --check` — passed for the TC-09-owned files.

## Explicitly unverified here

- Preference loading and UI controls.
- Final-only execution after streaming, raw-history preservation, cache reprocessing, and
  auto-copy behavior (TC-08 and TUI-15).
- Assistant success-transition automation and message persistence (N01).
- Electron/runtime integration and real provider output.

The pure pipeline is verified; these integration owners must not cite this record as proof that
post-processing is invoked at the correct application lifecycle boundary.
