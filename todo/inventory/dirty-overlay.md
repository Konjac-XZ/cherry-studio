# Dirty tracked source overlay inventory

Source identity: `main` at `917967aea8f46f5fe8ff3e4f87ec6b41e9fce8b2` plus tracked patch hash `b66be933979532438c0466dd2ea16c93b6714dd1`. The overlay modifies 37 tracked files. It is authoritative migration input but had not been committed or fully validated in v1.

## D01 Claude Sonnet 5 registry and reasoning behavior

- Status: `verified` on 2026-08-06 through N14. V2 keeps its newer 128K ceiling, canonical
  capability metadata and effort vocabulary; direct/slash/Bedrock aliases normalize consistently,
  and first-party Anthropic server-tool eligibility was added at the provider-registry seam.
- Old paths: `config/models/{default,reasoning,utils,vision,websearch}.ts`, `aiCore/prepareParams/modelParameters.ts`, `aiCore/utils/reasoning.ts`, and their focused tests.
- Intended behavior:
  - register `claude-sonnet-5` with readable name/group;
  - classify it as reasoning-, vision-, and web-search-capable;
  - use a 64K output/token ceiling and exclude obsolete classic max-token paths;
  - Anthropic-native requests use adaptive thinking with `display: summarized` and native low/medium/high/xhigh effort mapping;
  - Bedrock adaptive thinking maps the strongest unsupported native effort to Bedrock `max`.
- V2 evidence: provider registry already contains Sonnet 5 and an Anthropic adaptive/summarized reasoning profile, but V2 UI/control tests expose low/medium/high/max. Verify registry metadata, 64K limit, vision/web-search capability, and transport-specific effort canonicalization. A similarly named registry entry is not sufficient.
- Disposition rule: mark `v2-native` only after focused wire-option/capability tests prove the same intent; otherwise patch the provider registry/main AI path, not legacy renderer helpers.

## D02 Decoded JSON string display

- Status: `verified` in the isolated V2 JSON renderer.
- Old paths: `pages/translate/components/JsonStructureView.tsx` and test.
- Behavior: parsed string values render directly, so newline/tab/quotes/backslashes show as decoded characters under `white-space: pre-wrap`; HTML-like text remains safe as a React text node. Parser, raw/full copy, history/cache, and Markdown fallback do not change.

## D03 Dedicated JSON-view settings section

- Status: `verified` on 2026-08-06. JSON controls occupy their own responsive side-panel section;
  Misc retains auto-copy and post-processing remains independent.
- Old paths: `TranslateSettings.tsx`, page prop/state wiring, i18n.
- Behavior: move JSON controls from Misc into their own card; Misc retains auto-copy; post-processing card sizing/layout remains balanced and responsive.

## D04 Four JSON native-selection separators

- Status: `verified` on 2026-08-06. Pure normalization, renderer copy boundary, generated typed
  Preference, page runtime binding, settings selection, and V1 migration are verified.
- Old paths: JSON view/output/page/settings/settings-sync/repository types and tests plus locale files.
- Behavior: persisted typed union with default/fallback `colon-space`; mappings are `colon-space -> ': '`, `colon-newline -> ':\n'`, `chinese-colon -> '：'`, `chinese-colon-newline -> '：\n'`; dropdown disables when structure view is off without erasing the saved choice; scope is native table selection copy only.
- Persistence key: `translate:json-structure-view:copy-separator`.

## D05 Optional blank line between selected JSON rows

- Status: `verified` on 2026-08-06. Copy-boundary behavior, default-off typed Preference, disabled
  control semantics, runtime binding, and migration are verified.
- Behavior: persisted boolean default off; switch disables with structure view; one row boundary becomes a Markdown blank line; column separator and row separator are distinguished so newline-bearing separators are not doubled between key and value.
- Persistence key: `translate:json-structure-view:copy-blank-line-between-rows`.

## D06 Dirty tests and locale propagation

- Status: `verified` on 2026-08-06. JSON parser/display/copy, settings/page propagation, synced
  locales, migration, and Sonnet overlay domains all have current V2 focused coverage.
- Old paths: all 37 files enumerated with `Dirty overlay = yes` in `source-path-coverage.md`.
- Behavior evidence: model tests cover registry/classification/reasoning/wire options; JSON tests cover decoded strings, all four separators, blank-row behavior, prop forwarding, settings restoration, repository roundtrip/fallback; locale additions span en-US, zh-CN, zh-TW, de, el, es, fr, ja, pt, ro, ru, vi and preserve requested literal ` + ` label spacing.
- Validation boundary: prior notes explicitly left parts of the JSON preference work unvalidated. Recreate V2 tests; do not report these old dirty changes as previously passing.
