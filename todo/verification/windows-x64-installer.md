# Windows x64 installer artifact

Status: `verified` on 2026-08-06 (Asia/Shanghai).

`pnpm build:win:x64` completed successfully after the pinned bundled binaries were downloaded and
verified. The build used the repository's V2 production build, Electron Builder NSIS x64,
`nsis.packElevateHelper=false`, store compression, and the personal unsigned environment isolated by
`scripts/build-win-x64.js`.

| Field | Value |
| --- | --- |
| Absolute path | `D:\GitHub\cherry-studio-v2-custom-migration\dist\Cherry-Studio-2.0.0-x64-setup.exe` |
| Size | 1,256,379,775 bytes (1,198.18 MiB) |
| SHA-256 | `FE2C22D203B903C2B34591EABFA43054928FBC7F719705D100475A4235605CA5` |
| Build timestamp | `2026-08-06T04:04:34.2990023+08:00` |

The artifact is an unsigned personal build. Successful packaging does not establish release signing
or installation/launch UX on a separate clean Windows machine.
