import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type MetrosFile,
  type Dials,
  dialsFromDefaults,
  runModel,
  breakevenYear,
  itemize,
} from "@/lib/contract";
import { formatDate } from "@/lib/format";
import { CrossoverChart } from "@/components/CrossoverChart";
import { ComparisonTable } from "@/components/ComparisonTable";
import { StayControl } from "@/components/StayControl";
import { Assumptions } from "@/components/Assumptions";
import { MetroCombobox } from "@/components/MetroCombobox";
import { defaultSlug, slugFromHash } from "@/lib/metro";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-[clamp(14px,3vw,20px)] py-[clamp(16px,3vw,34px)]">
      <div className="mx-auto max-w-[940px]">{children}</div>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState<MetrosFile | null>(null);
  const [error, setError] = useState(false);
  const [slug, setSlug] = useState("cleveland-oh");
  const [exit, setExit] = useState(6);
  const [dials, setDials] = useState<Dials | null>(null);

  useEffect(() => {
    // no-cache → always revalidate, so a new build never reads a browser-cached older metros.json
    // (the file is unhashed and its shape can change between schema versions)
    fetch(import.meta.env.BASE_URL + "metros.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((f: MetrosFile) => {
        setFile(f);
        setDials(dialsFromDefaults(f.defaults));
        setSlug(slugFromHash(window.location.hash, f.metros) ?? defaultSlug(f.metros));
      })
      .catch(() => setError(true));
  }, []);

  // shareable deep-link: mirror the selected metro's slug in the URL, and restore it on URL change
  useEffect(() => {
    if (file && slug) window.history.replaceState(null, "", "#" + slug);
  }, [file, slug]);
  useEffect(() => {
    if (!file) return;
    const onHash = () => {
      const s = slugFromHash(window.location.hash, file.metros);
      if (s) setSlug(s);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [file]);

  const metro = file?.metros.find((m) => m.slug === slug) ?? file?.metros[0];
  const proj = useMemo(
    () => (file && dials && metro ? runModel(metro, file.defaults, dials) : null),
    [file, dials, metro],
  );
  const be = useMemo(() => (proj ? breakevenYear(proj) : null), [proj]);
  const it = useMemo(
    () => (proj && file && dials && metro ? itemize(proj, metro, dials, exit) : null),
    [proj, file, dials, metro, exit],
  );

  if (error) {
    return (
      <Shell>
        <p className="font-serif text-lg text-bob">Couldn't load the housing data.</p>
        <p className="mt-2 text-ink-2">Please refresh the page to try again.</p>
      </Shell>
    );
  }
  if (!file || !dials || !metro || !proj || !it) {
    return (
      <Shell>
        <p className="text-ink-3">Loading…</p>
      </Shell>
    );
  }

  const city = metro.name.split(",")[0];
  const horizon = file.defaults.horizonYears;
  const setDial = (key: keyof Dials, value: number) => setDials((d) => (d ? { ...d, [key]: value } : d));
  const reset = () => setDials(dialsFromDefaults(file.defaults));

  return (
    <Shell>
      <div className="flex items-baseline justify-between gap-3 pb-3 text-[0.76rem] text-ink-3">
        <span>Last updated {formatDate(file.generatedAt)} (UTC)</span>
        <a
          href="https://github.com/prince-ao/tb-ntb"
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-hair-2 text-ink-2 hover:border-ink hover:text-ink"
        >
          View the source on GitHub ↗
        </a>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <img
            src={import.meta.env.BASE_URL + "logo.png"}
            alt=""
            aria-hidden="true"
            className="h-[clamp(1.9rem,4.4vw,2.5rem)] w-auto shrink-0"
          />
          <h1 className="font-serif text-[clamp(1.5rem,3.6vw,2rem)] font-bold tracking-tight">To Buy, or Not to Buy</h1>
        </div>
        <div className="flex items-baseline gap-2 text-[0.85rem] text-ink-2">
          <span>Metro:</span>
          <MetroCombobox metros={file.metros} value={slug} onChange={setSlug} />
        </div>
      </header>
      <hr className="mt-3 border-t-2 border-ink" />
      <p className="mt-3 max-w-[52ch] font-serif text-[clamp(1.05rem,1.9vw,1.24rem)] italic leading-[1.75] text-ink-2">
        <span className="text-alice">Hannah</span> signs the deed and takes the debt;
        <br />
        <span className="text-bob">Ryan</span> keeps his cash and lets it grow.
        <br />
        Which one ends the wealthier, and when —
        <br />
        the figures here, year over year, will show.
      </p>

      <figure className="m-0 pb-3.5 pt-[18px]">
        <h2 className="mb-2.5 text-balance font-serif text-[clamp(1.15rem,2.4vw,1.45rem)] font-bold leading-tight tracking-tight">
          In {city},{" "}
          {be ? (
            <>
              <span className="text-alice">Hannah</span> overtakes <span className="text-bob">Ryan</span> in year {be}.
            </>
          ) : (
            <>
              <span className="text-bob">Ryan</span> stays ahead the whole time.
            </>
          )}
        </h2>
        <CrossoverChart proj={proj} exit={exit} breakeven={be} />
        <figcaption className="mt-1.5 font-serif text-[0.8rem] italic text-ink-3">
          Sources: {file.sources.homeValues.name} ({file.sources.homeValues.asOf}); {file.sources.mortgageRate.name}.
          Computed by the <code className="font-mono not-italic">@tb-ntb/model</code> engine.
        </figcaption>
      </figure>

      <StayControl value={exit} max={horizon} onChange={setExit} />
      <ComparisonTable it={it} year={exit} />
      <Assumptions
        dials={dials}
        setDial={setDial}
        onReset={reset}
        marketRate={file.defaults.mortgageRate[dials.loanTermYears === 15 ? "15" : "30"]}
        marketInflation={file.defaults.currentInflation}
        propertyTax={metro.propertyTaxRate}
      />

      <p className="mt-[22px] border-t border-hair pt-3 text-[0.75rem] leading-relaxed text-ink-3">
        An illustrative model, not financial advice — it computes outcomes from the assumptions above, it does not
        predict prices. Figures currently use committed sample data, not live market rates.
      </p>
    </Shell>
  );
}
