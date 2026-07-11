# Web App (APP)

> **Status: skeleton.** Complete at the APP segment's Phase 2 stop.

## Context and Design Philosophy

A static, one-screen read-and-flex view. Loads `metros.json`, runs `@tb-ntb/model` live, renders
the crossover chart and the breakeven headline, and exposes dials — including a per-year
appreciation control. The credibility of the tool *is* the visibility of its assumptions, so the
assumptions strip is a feature, not chrome.

## Screen (draft)

```
┌───────────────────────────────────────────────┐
│ To Buy, or Not to Buy   [ metro selector ▾ ]   │
├───────────────────────────────────────────────┤
│ "Buying beats renting if you stay past year 7" │  ← breakeven headline
│                                                │
│   net worth  ┌───────────────────────┐         │
│              │ buyer vs. renter lines │         │  ← crossover chart
│              └───────────────────────┘  yr 1–10 │
│                                                │
│ Assumptions: rate 6.8% · tax 1.7% · appr [dial]│  ← visible + adjustable
│ Price-to-rent: 20.3                            │
└───────────────────────────────────────────────┘
```

## Dependencies

- Data: fixture in dev → real `metros.json` in prod (same shape). Never depends on PIPE directly.
- Compute: `@tb-ntb/model`, called on every interaction. No network for the simulation.

## Metro selection

The covered metro set is whatever the pipeline discovers (currently ~700+ US metros; not hand-picked).
A plain dropdown is unusable at that size, so the selector is a **searchable, scrollable combobox**:

- Click/focus opens a popover with a text input and a scrollable, height-capped list of all metros.
- Typing filters the list case-insensitively by metro **name** and two-letter **state code** (so "tx",
  "austin", or "austin, tx" all narrow it).
- The list is keyboard-navigable (↑/↓ move, Enter chooses, Esc closes) and mouse/touch-scrollable.
- Choosing a metro sets the active metro and closes the popover; the trigger shows the current selection.
- If the filter matches nothing, the list shows a "No metro found" message rather than an empty box.
- Default selection on load is a stable preferred slug if present, else the first metro in the file.
- The selected metro's slug lives in the URL hash (e.g. `…/tb-ntb/#pittsburgh-pa`), so a view is shareable; opening such a link selects that metro. The slug is the contract's "URL-safe deep-link key."

Built on shadcn's Combobox pattern (Radix Popover + `cmdk`). Filtering is entirely client-side
(no backend — consistent with the compute-in-browser design). Rendering ~700 items in a capped,
scrollable list is acceptable; list virtualization is deferred unless it measurably lags.

## Branding & voice

The title *To Buy, or Not to Buy* is a Hamlet allusion, and the app leans into it rather than
apologising for it:

- **Logo lockup.** A pen-nib-enclosing-a-house mark (the "author's pen" of the analysis) sits
  immediately before the title, and is the sole element of the favicon and social card — rendered
  logo-only on a transparent ground (no filled tile), so it carries on any background. The mark is
  decorative next to the always-present title text, so it is `aria-hidden`.
- **Verse epigraph.** The standfirst under the title is a short Shakespearean quatrain that introduces
  Hannah (buys) and Ryan (rents), not a prose blurb — keeping voice with the title. The two names are
  colour-coded to their chart series so the poem reads into the graphic.
- **No fixed-horizon claims in outward copy.** The tool's horizon is user-adjustable, so the poem, the
  `<meta>`/Open-Graph/Twitter descriptions, and the social card all speak of *the long run* — never a
  specific year count (an earlier "over ten years" claim was both wrong and un-adjustable). Concrete
  years appear only *inside* the live UI, where they are driven by the data and the slider.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Data source in dev | Committed fixture | Wait for the pipeline | Decouples APP from PIPE — the parallelism mechanism. |
| Where assumption defaults live | In the app | In the data contract | They're user dials, not metro facts. |
| Framework / chart lib | *(TODO — APP decision)* | Next.js+Recharts (artifact suggestion), others | Must produce a static bundle for Pages. |
| Metro selector | Searchable, scrollable combobox (Popover + `cmdk`) | Plain `<select>` (unusable at ~700 metros); group-by-state; server-side search (no backend) | Covered set is large and pipeline-discovered; type-to-filter is the only usable client-side pattern. |
| Intro copy | Verse epigraph (quatrain) | Prose blurb | Keeps voice with the Hamlet title; the prose read AI-generated. |
| Horizon in outward copy | Qualitative ("the long run") | A fixed year count | Horizon is user-adjustable; a baked number drifts from the data and misleads on the share card. |

## Open Questions & Future Decisions

### Deferred
1. Static framework + chart library.
2. The exact v1 dial set (metro, scenario, per-year appreciation at minimum).
3. UX for editing a per-year schedule (drag points vs. per-year inputs).
4. Rendering the honest "never within 10 years" case.

## References
- `packages/app/README.md`, `artifacts/rent-vs-buy-mvp-spec.md § 7`, `agent-docs/specs/app.md`
