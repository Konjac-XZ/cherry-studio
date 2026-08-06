# N15/N16 UI Defaults Verification

Date: 2026-08-06

## Implemented contracts

- QuickPanel provider state and omitted-open fallback both use a 14-row page size. The existing
  fixed, fill, docked and read-only geometry tests were updated from the former 7-row default.
- ModelSelector retains its V2 virtualized, unpaginated list and fixed 440 px content viewport. Its
  PageUp/PageDown traversal uses the shared 25-item default; explicit caller overrides and boundary
  clamping remain supported.
- V2 assistants have no `knowledgeRecognition` field. `kb_search` is available by default when the
  resolved request scope contains at least one knowledge base and the application has a knowledge
  base; empty scopes remain unavailable.

## Focused verification

1. `pnpm exec vitest run --project renderer src/renderer/components/QuickPanel/__tests__/view.test.tsx src/renderer/components/ModelSelector/__tests__/useModelListKeyboardNav.test.ts`
   - Result: pass, 2 files and 44 tests.
   - Covers the 14-row provider/open fallback, QuickPanel height behavior at the new default,
     25-item default model traversal, explicit page-size override and boundary clamping.
2. `pnpm exec vitest run --project renderer src/renderer/components/ModelSelector/__tests__/ModelSelector.test.tsx`
   - Result: pass, 1 file and 13 tests.
   - Confirms the current virtualized ModelSelector component behavior remains intact.
3. `pnpm exec vitest run --project main src/main/ai/tools/adapters/aiSdk/builtin/__tests__/KnowledgeSearchTool.test.ts`
   - Result: pass, 1 file and 12 tests.
   - Covers missing legacy-toggle enablement for a non-empty effective knowledge scope as well as
     the existing empty/unavailable-scope guards.
4. `pnpm typecheck:web`
   - Result: pass.
5. `pnpm typecheck:node`
   - Result: pass.

## Validation boundary

These checks establish the V2 defaults, traversal behavior, geometry calculations, component
regression coverage and knowledge-tool applicability in unit tests. They do not constitute manual
Electron UI validation at multiple physical viewport sizes.
