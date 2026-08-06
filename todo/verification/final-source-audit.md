# Fresh final source audit

Status: `verified` on 2026-08-06 (Asia/Shanghai), including repository-wide checks and installer
acceptance.

## Immutable source check

- Pinned committed boundary:
  `14510c940964046351dec5b36ee97d13b1a00339..917967aea8f46f5fe8ff3e4f87ec6b41e9fce8b2`.
- Recomputed committed paths: 286.
- Recomputed dirty tracked paths: 37.
- Dirty overlay hash remains
  `b66be933979532438c0466dd2ea16c93b6714dd1`, exactly matching `todo/source-refs.md`.
- Source worktree still has no untracked migration input.

## Path-accounting result

The source path list was regenerated from Git and compared programmatically with every path row in
`source-path-coverage.md`.

| Check | Result |
| --- | ---: |
| Unique covered rows | 294 |
| Missing committed paths | 0 |
| Missing dirty-overlay paths | 0 |
| Extra/stale matrix paths | 0 |
| Unresolved `AUDIT` rows | 0 |

The 294 unique paths equal the union of the 286 committed paths and 37 dirty paths because 29 dirty
paths also occur in the committed endpoint diff.

## Region and intent reread

The 126 non-merge commit subjects and the complete dirty overlay were reread against the category
crosswalk and behavior ledgers. Translate execution/settings/UI commits map to TC/TUI owners;
conversation/provider/model/navigation/rendering commits map to N owners; build/workflow/hygiene and
upstream/noise regions map to R dispositions. Multi-owner paths retain the explicit region overrides
in `ownership-crosswalk.md`.

This reread found one genuine V2 gap: N10's upstream inline input-translation workflow had vanished,
so focus behavior could not be called native-equivalent. It was restored through a V2 Composer
action and an extracted completion coordinator, then verified. It also found stale ledger states for
already-wired JSON preferences/settings, request options, custom-language CRUD, and the Sonnet dirty
overlay; those authoritative rows were reconciled to their current focused evidence.

No meaningful committed or dirty-overlay behavior remains without a verified task or verified
V2-native/no-port disposition. TC-18's current A-G matrix is recorded separately and passed 51
files / 474 tests. The complete configured Linux/CI Vitest suite subsequently passed 5,846 suites /
21,415 tests with zero failures, and R01 produced the recorded Windows x64 installer artifact.
