# Cherry Studio V2 customization migration ledger

This directory is the persistent source of truth for the migration. Source-code migration must remain traceable to the inventories here; a task is not complete merely because the application builds.

## Status vocabulary

- `identified`: present in the source diff but not yet fully analyzed against V2.
- `ready`: behavior, source trace, V2 design, and verification plan are understood.
- `implemented`: code is present on the V2 migration branch but verification is incomplete.
- `verified`: implementation and relevant focused checks have passed.
- `blocked`: unresolved exceptional conflict with a fundamental V2 design invariant; alternatives and risks must be documented.
- `not-migrated`: permitted only after the user accepts a documented exceptional blocker. This is not a convenience disposition.
- `v2-native`: V2 already provides an equivalent; the equivalence and verification evidence must be recorded.
- `noise`: a diff item with no customization behavior (for example an upstream-sync artifact); the classification must include evidence.

## Ledger structure

- `source-refs.md`: immutable source/target identifiers and diff boundaries.
- `inventory/`: behavior-level inventories with old-path and diff-region traceability.
- `inventory/ownership-crosswalk.md`: non-colliding path-category to task ownership and verifier mapping.
- `implementation/`: design and status records for migrated task groups.
- `verification/`: commands, results, completeness audits, and installer artifact details.

## Completion gates

1. Every meaningful committed source-diff region and dirty tracked overlay is mapped to a task, a verified V2-native equivalent, or an evidenced noise classification.
2. The original source diff is independently re-read after implementation; omissions return to the inventory.
3. All repository-configured linters and unit tests pass.
4. A Windows x64 installer is successfully built and its exact path and filename are recorded.
5. Any unresolved item satisfies the exceptional architectural-blocker criteria in the goal and is reported separately.
