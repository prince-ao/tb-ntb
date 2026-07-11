# EARS Specs — Web App (APP)

> **Status: seed.** Starter specs. Complete at the APP Phase 3 stop.

## Core view

- [x] **APP-UI-001**: The system shall let the user select any metro from the covered set through a searchable list.
- [ ] **APP-UI-002**: When a metro is selected, the system shall display the buyer-vs-renter net-worth crossover over the horizon and the breakeven headline.
- [ ] **APP-UI-003**: The system shall display the assumptions in use (at minimum mortgage rate, property tax, and appreciation) visibly alongside the result.
- [ ] **APP-UI-004**: When the user changes any assumption, the system shall recompute and re-render the projection without a page reload or network request.
- [ ] **APP-UI-005**: The system shall let the user adjust appreciation on a per-year basis and reflect the change in the projection.
- [ ] **APP-UI-006**: When buying never wins within the horizon, the system shall state that honestly rather than implying a breakeven.
- [ ] **APP-UI-007**: The system shall display the metro's price-to-rent readout.

## Metro selection
- [x] **APP-UI-008**: While the user types a query in the metro selector, the system shall show only metros whose name or two-letter state code contains the query (case-insensitive substring).
- [x] **APP-UI-009**: The system shall show at most 20 metros at once and, when more match than are shown, indicate that more exist so the user narrows by typing.
- [x] **APP-UI-010**: The system shall let the user operate the metro selector by keyboard alone — navigate the options, commit a selection, and dismiss it.
- [x] **APP-UI-011**: If the query matches no metro, then the system shall show a "no metro found" message rather than an empty list.
- [x] **APP-UI-012**: On initial load the system shall select a default metro — a stable preferred slug when present in the file, otherwise the first metro.
- [x] **APP-UI-013**: The system shall keep the selected metro's slug in the page URL and, on load or URL change, select the metro the URL names (when it names one in the covered set) — so a metro view is shareable by link.

## Data loading
- [ ] **APP-DATA-001**: The system shall render from a `metros.json` conforming to the data contract, using the committed fixture in development.
- [ ] **APP-DATA-002**: If `metros.json` fails to load, then the system shall show an error state rather than a blank screen.

## Deploy
- [ ] **APP-DEPLOY-001**: The system shall build the static app and deploy it to GitHub Pages on changes to the app, model, or contract. *(Re-homed from `INFRA-PROC-002` per the 2026-07-03 segmentation decision; the workflow is `deploy-pages.yml`.)*

## Open (to spec at Phase 3)
- Full v1 dial set; per-year editing interaction.
