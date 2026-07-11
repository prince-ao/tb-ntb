import type { Itemized } from "@/lib/contract";
import { money } from "@/lib/format";

function Row({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 px-4 py-[9px]">
      <span className="flex flex-col text-[0.9rem] text-ink">
        {label}
        <span className="mt-px text-[0.72rem] text-ink-3">{sub}</span>
      </span>
      <span className="whitespace-nowrap text-[1.02rem] font-semibold text-ink">{value}</span>
    </div>
  );
}

function Head({ name, role, tone }: { name: string; role: string; tone: "alice" | "bob" }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-hair-2 px-4 pb-2.5 pt-3">
      <span className={`font-serif text-[1.1rem] font-bold ${tone === "alice" ? "text-alice" : "text-bob"}`}>{name}</span>
      <span className="text-[0.8rem] text-ink-3">{role}</span>
    </div>
  );
}

function NetWorth({ value, ahead, tone }: { value: string; ahead: boolean; tone: "alice" | "bob" }) {
  return (
    <div className="mt-auto flex items-baseline justify-between gap-3.5 border-t-2 border-ink px-4 pb-3 pt-2.5">
      <span className="flex items-center gap-2 text-[0.9rem] font-bold text-ink">
        Net worth
        {ahead && (
          <span className={`rounded px-1.5 py-px text-[0.6rem] font-bold uppercase tracking-wide text-panel ${tone === "alice" ? "bg-alice" : "bg-bob"}`}>
            ahead
          </span>
        )}
      </span>
      <span
        className="whitespace-nowrap rounded px-1.5 text-[1.18rem] font-bold text-ink"
        style={{ background: ahead ? (tone === "alice" ? "var(--alice-soft)" : "var(--bob-soft)") : undefined }}
      >
        {value}
      </span>
    </div>
  );
}

export function ComparisonTable({ it, year }: { it: Itemized; year: number }) {
  const hannahAhead = it.netHannah >= it.netRyan;
  return (
    <section className="pt-[18px]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[1.1rem] font-bold">Where the money sits at year {year}</h2>
        <span className="text-[0.78rem] text-ink-3">who&apos;s ahead at your exit year</span>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-md border border-hair-2 sm:grid-cols-2">
        <div className="flex flex-col border-t-[3px] border-alice">
          <Head name="Hannah" role="buys" tone="alice" />
          <div className="divide-y divide-hair">
            <Row label="Home value" sub="grows with prices" value={money(it.home)} />
            <Row label="Down payment" sub="one-time, at purchase" value={money(it.downPayment)} />
            <Row label="Closing cost" sub="one-time" value={money(it.closingCost)} />
            <Row label="Monthly payment" sub="fixed for the term" value={`${money(it.monthlyPayment)}/mo`} />
            <Row label="Home equity" sub="builds each year" value={money(it.equity)} />
            <Row label="Interest paid" sub="cumulative" value={money(it.interestPaid)} />
          </div>
          <NetWorth value={money(it.netHannah)} ahead={hannahAhead} tone="alice" />
        </div>
        <div className="flex flex-col border-t-[3px] border-bob sm:border-l sm:border-l-hair-2">
          <Head name="Ryan" role="rents" tone="bob" />
          <div className="divide-y divide-hair">
            <Row label="Upfront cost" sub={`deposit ${money(it.deposit)} + fee ${money(it.appFee)}`} value={money(it.upfront)} />
            <Row label="Monthly rent" sub="rises each year" value={`${money(it.monthlyRent)}/mo`} />
            <Row label="Investments" sub="grows each year" value={money(it.investments)} />
            <Row label="Total rent paid" sub="cumulative" value={money(it.rentPaid)} />
          </div>
          <NetWorth value={money(it.netRyan)} ahead={!hannahAhead} tone="bob" />
        </div>
      </div>
    </section>
  );
}
