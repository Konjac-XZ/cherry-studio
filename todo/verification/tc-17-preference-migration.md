# TC-17 Preference Migration and Defaults

Status: complete settings boundary `verified` on 2026-08-06 (Asia/Shanghai). The later runtime
integration was completed and is recorded below.

## Implemented boundary

- Added the complete durable V1 translation preference surface to the V2 classification inputs and
  regenerated the typed Preference schema and simple migration mappings with the repository tool.
- Preserved customized defaults for Markdown, font/layout, JSON presentation/copying,
  post-processing, paste conversion, polish routing, reasoning policy, request parameters, prompts,
  and directional model policy.
- Added `heuristic` to the persisted language-detection strategy type.
- Converted V1 JSON `{ provider, id }` directional/polish model identities to V2
  `provider::model` identities.
- Applied explicit per-direction follow-global values before the older shared fallback preference.
- Kept `translate-panel-size` as browser-local UI state because that is its actual V1 ownership; it
  is not represented as an invented SQLite preference.
- Added an end-to-end PreferencesMigrator fixture that asserts all customized settings, including
  the dirty-overlay JSON copy settings, reach their V2 keys without reset or omission.

## Verification

- Supported `npm run generate` in `v2-refactor-temp/tools/data-classify` — passed.
- `pnpm typecheck` — passed (node, web, aiCore).
- Main preference/mapping focused tests — 4 files, 97 tests passed.
- `pnpm db:migrations:check` — passed.
- `git diff --check` — passed.

## Completed runtime integration

- TranslatePage now loads the generated typed preferences as one page settings model and passes
  JSON, post-processing, model, language, prompt, request, layout, clipboard, and polish values to
  their extracted owners.
- TranslateSettings exposes those owners as focused sections and uses rollback-capable preference
  and DataApi mutations with visible failures.
- JSON enum/boolean defaults, numeric layout/font normalization, request parameter conversion, and
  migrated provider-qualified model identities are covered by focused page/settings/migration
  tests. Final full-repository acceptance remains separate from this focused record.
