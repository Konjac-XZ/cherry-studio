---
title: Translation sampling parameters respect model capabilities
category: changed
severity: notice
introduced_in_pr: pending
date: 2026-09-06
---

## What changed

Translation and polishing keep their separate custom-parameter settings. Temperature and top-p now follow the selected model's sampling restrictions; unsupported parameters are omitted and supported values are clamped where required. `top_p` is normalized to `topP`, and explicit `topP` wins when both are configured.

## Why this matters to the user

Custom sampling values no longer bypass model capability checks. Turning thinking off still selects the lowest supported tier when the model cannot disable it. Other provider-specific parameters remain explicit overrides.

## What the user should do

Nothing for valid settings. Correct invalid temperature values outside 0–2 or top-p values outside 0–1 if translation reports a validation error. The existing translation and polishing parameter editors remain the active settings.
