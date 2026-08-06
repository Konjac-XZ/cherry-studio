# Migration source and target references

Recorded on 2026-08-05 (Asia/Shanghai), after refreshing the `upstream` remote.

## Authoritative source boundaries

| Role | Reference used | Commit | Notes |
| --- | --- | --- | --- |
| Corresponding v1 upstream baseline | historical `upstream/v1` tip at task start; also `merge-base(main, current upstream/v1)` | `14510c940964046351dec5b36ee97d13b1a00339` | This is the exact upstream baseline incorporated by the customized branch. The remote-tracking ref advanced after fetch; the raw commit is pinned here to prevent baseline drift. |
| Customized old branch | `main` | `917967aea8f46f5fe8ff3e4f87ec6b41e9fce8b2` | Branch tip at inventory start. |
| Customized dirty overlay | tracked worktree diff relative to `main` | Git hash-object `b66be933979532438c0466dd2ea16c93b6714dd1` | 37 modified tracked files, 489 insertions and 30 deletions; no untracked files. This overlay is inventory input and must remain preserved in the source worktree. |
| Released V2 target | tag `v2.0.0` | `e31b31b4355afa06359c17b587d16625d8f12d79` | Release commit dated 2026-08-05. |
| Migration branch | `codex/v2-custom-migration` | initially `e31b31b4355afa06359c17b587d16625d8f12d79` | Isolated worktree at `D:\GitHub\cherry-studio-v2-custom-migration`. |

## Current remote context

- After fetch, `upstream/v1` is `893cd5f7687ef860ecec8140e21659be7850e177`, 12 commits ahead of the corresponding baseline. It is not used as the customization-diff baseline because doing so would misclassify unmerged upstream changes as user deletions.
- The historical `v2-migrate` branch is `08e151c1e0c67014048900e6f6824261d4d5b6ae`. Its merge-base with `v2.0.0` is `337e2403039e6f9bf5084702053b2e38c3441f27`; it has 228 commits absent from the release and lacks 1,130 release-side commits. It is evidence for prior intent/implementations, not the target base.

## Diff commands

Committed customization tree diff:

```powershell
git -C D:\GitHub\cherry-studio -c diff.renameLimit=10000 diff 14510c940964046351dec5b36ee97d13b1a00339 917967aea8f46f5fe8ff3e4f87ec6b41e9fce8b2
```

Dirty tracked overlay:

```powershell
git -C D:\GitHub\cherry-studio diff 917967aea8f46f5fe8ff3e4f87ec6b41e9fce8b2
```

Target comparison:

```powershell
git -C D:\GitHub\cherry-studio-v2-custom-migration diff v2.0.0
```

## Initial scale

- Committed source diff against the pinned matching baseline: 286 files, 22,310 insertions, 2,655 deletions.
- For comparison only, diffing the customized branch against the newly fetched `upstream/v1` tip would show 357 files, 25,605 insertions, and 7,408 deletions; that larger figure includes the 12 unmerged upstream commits and is not the customization inventory boundary.
- Unique commits reachable from customized `main` but not the matching baseline: 296 total, 126 non-merge.
- Dirty overlay: 37 tracked files, 489 insertions, 30 deletions.
