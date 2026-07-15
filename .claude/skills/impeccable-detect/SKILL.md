---
name: impeccable-detect
description: >-
  Run impeccable's design-quality detector on this repo's frontend (React/TSX,
  JSX, CSS, HTML) to catch UI anti-patterns and "AI design tells" — overused
  fonts, generic purple/blue gradients, low-contrast text, cards-in-cards,
  default bounce easings, and similar. Use when the user asks to audit,
  critique, review, or check the design / frontend / UI quality, or before
  committing styling/UI changes. Runs offline via the npm-published `impeccable`
  CLI — no external design bundle or API key required, so it works in Claude
  Code Web.
---

# Impeccable detector

A thin wrapper around the [impeccable](https://github.com/pbakaus/impeccable)
CLI's deterministic detector. impeccable's full 23-command design skill is
distributed as a bundle from `impeccable.style`, which this environment's egress
policy blocks. The **detector engine**, however, ships in the `impeccable` npm
package (npm is reachable), runs fully offline on local files, and is what this
skill drives.

## When to use

- The user asks to **audit / critique / review / check** the UI, frontend, or
  design quality.
- **Before committing** changes to components, styles, Tailwind classes, or CSS.
- To get a quick, deterministic list of design anti-patterns to fix or triage.

## How to run

Run from the repo root. `--yes` lets `npx` fetch the package from npm the first
time without prompting; later runs use the cache.

```bash
# Human-readable scan of the whole app
npx --yes impeccable detect src/

# JSON output (use this when you need to parse/summarize findings)
npx --yes impeccable detect --json src/

# Just the count
npx --yes impeccable detect src/ --quiet

# A single file or subtree
npx --yes impeccable detect src/components/

# Narrow to a design domain (comma-separated: type, layout)
npx --yes impeccable detect --scope type,layout src/
```

Detection modes are auto-selected: `.tsx/.jsx/.css` use regex/pattern matching,
`.html` uses static HTML/CSS analysis, and URLs use a full browser render
(needs network + Puppeteer — not available here, so stick to local files).

## Interpreting output

- Exit code is `0` even when anti-patterns are found; read the printed findings
  (or the `--json` payload), don't rely on exit status to gate anything.
- Each finding names a **rule id** (e.g. `overused-font`, `low-contrast`). Report
  findings to the user grouped by rule/severity, with file locations, and
  suggest concrete fixes rather than dumping raw output.
- Prefer `--json` when you need to count, sort, or summarize; use the plain text
  form when you just want to show the user what's wrong.

## Suppressing false positives

Waive a finding in-file (travels with the code):

```tsx
// impeccable-disable-next-line overused-font: brand requirement
<h1 className="font-inter">…</h1>
```

`impeccable-disable` (whole file), `-line`, and `-next-line` are all supported;
list comma-separated rule ids or omit for all. Project-wide ignores go in
`.impeccable/config.json` (`detector.ignoreRules` / `ignoreFiles` /
`ignoreValues`); a local `DESIGN.md` is auto-loaded as design-system context.

## Notes / limits

- This wraps the **detector only**. The `/impeccable` design *commands* (audit,
  polish, craft, …) come from the impeccable plugin/skill bundle, which requires
  reaching `impeccable.style`. If that host is later allowlisted, run
  `npx impeccable install` to vendor the full skill.
- Everything here is offline and deterministic — safe to run in CI or web
  sessions.
