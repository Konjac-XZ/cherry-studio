---
title: Translation shortcuts and history use explicit task switching
category: changed
severity: notice
introduced_in_pr: pending
date: 2026-09-05
---

## What changed

The global Translate Clipboard shortcut replaces the current translation after reading valid clipboard text. Using a history entry also cancels the current translation, while preserving the selected source and target languages for subsequent translations. Clipboard monitoring waits for the current task to finish and then considers only the latest clipboard content; disabling monitoring discards pending reads.

## Why this matters to the user

New shortcuts are no longer silently ignored while translating. Reusing history no longer changes automatic language detection or the default target language, and cancelled tasks cannot overwrite the selected history entry.

## What the user should do

Nothing — automatic. Use Stop to cancel a running translation; turning off clipboard monitoring only prevents new automatic translations.
