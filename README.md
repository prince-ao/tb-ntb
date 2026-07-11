<p align="center">
  <img src="packages/app/public/logo.png" alt="To Buy, or Not to Buy" width="112" />
</p>

<h1 align="center">To Buy, or Not to Buy</h1>

<p align="center">
  Whether buying or renting builds more net worth over the next 1&ndash;10 years &mdash; under assumptions you can see and move.
</p>

## What is To Buy, or Not to Buy?

Pick a US metro. The tool shows whether buying a home or renting one builds more net
worth over the next 1&ndash;10 years, year by year, under assumptions you can see and
adjust. The answer updates instantly as you flex the dials &mdash; mortgage rate, rent
growth, how long you stay, and the rest.

The point is not prediction. It is **honest reasoning under stated assumptions**: every
number is visible, the future is shown as a range rather than a point, and nothing
extrapolates the recent past. When the honest answer is "it depends," the tool shows
what it depends on.

Under the hood it is two subsystems joined by one narrow data contract, so the data and
the model can be worked on independently and the whole thing runs for free.

| Subsystem | What it does | Runs on |
|---|---|---|
| **Data pipeline** (`pipeline/`) | Gathers public housing data on a schedule and emits one static `metros.json`. | GitHub Actions (cron) |
| **Application** (`packages/app`, `packages/model`) | Loads that file and runs the buy-vs-rent model live, in the browser. | GitHub Pages |

They meet at the **data contract** in `contract/`. The model is pure functions measured
in microseconds; there is no compute backend, and nothing costs money to run.

## Contributing

This repository is built with **[LID: Linked-Intent Development](https://github.com/jszmajda/lid)**, a spec-driven methodology where design documents are the source of truth and code is the regenerable output. You cannot meaningfully add a feature by editing code alone; the change starts upstream in `agent-docs/` and flows down.

**LID is required to contribute.**

## License

_To Buy, or Not to Buy?_ is licensed under the terms of the MIT license. See [LICENSE](https://github.com/prince-ao/tb-ntb/blob/main/LICENSE) for more information.
