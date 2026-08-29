# Downstream locale overlay

The files in `../locales` are upstream-owned and should remain byte-identical
to `upstream/main` whenever possible.

- `en-us.json` contains keys that exist only in this fork and supplies their
  English fallback for every renderer locale.
- Other locale files are sparse translations of those downstream-only keys.
- `overrides/*.json` contains intentional value changes for keys that are
  owned by upstream.

Runtime composition order is upstream catalog, downstream English, sparse
locale translation, then explicit override. `pnpm i18n:check` validates the
same order, rejects orphan sparse keys, and fails when upstream adopts a key
still listed as downstream-only so the overlay can be retired deliberately.

Add new fork-only keys to `en-us.json` and only add locale entries where a
localized value is available. Do not copy English placeholders into every
locale. Run `pnpm i18n:sync` to sort sparse files without expanding them.
