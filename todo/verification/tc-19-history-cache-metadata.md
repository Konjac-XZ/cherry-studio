# TC-19 History Cache Metadata Preservation

Status: `verified` on 2026-08-06 (Asia/Shanghai).

## Implemented boundary

- Additive SQLite columns and indexes for `modelId` and `cacheKey`.
- Forward-only Drizzle migration `0006_giant_james_howlett.sql`; no shipped migration rewritten and
  no table rebuild generated.
- Strict V2 entity/API support for provider-qualified model identity.
- Runtime history creation records the selected model and canonical normalized cache key.
- Update operations recompute cache identity when its constituent fields change.
- V1 JSON `{ provider, id }` identities migrate to V2 `provider::model` identities.
- Dangling-language histories cannot be reused; malformed legacy model IDs do not masquerade as a
  current model identity.

## Verification

- `pnpm db:migrations:check` — passed.
- `pnpm typecheck` — passed (node, web, aiCore).
- Main focused tests — 3 files, 47 tests passed.
- Renderer focused tests — 2 files, 20 tests passed.
- Shared Translate schema tests — 1 file, 29 tests passed.
- `git diff --check` — passed before focused testing; rerun at later gates after subsequent edits.

This verifies metadata preservation and API propagation only. TC-07/TUI-21 still own runtime cache
lookup, pre-detection restoration, feedback, force-refresh bypass and overwrite semantics.
