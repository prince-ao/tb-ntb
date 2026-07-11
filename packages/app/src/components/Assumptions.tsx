import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DIAL_SPECS, type DialSpec } from "@/lib/dials";
import type { Dials } from "@/lib/contract";
import { pct } from "@/lib/format";

interface Props {
  dials: Dials;
  setDial: (key: keyof Dials, value: number) => void;
  onReset: () => void;
  marketRate: number;
  marketInflation: number;
  propertyTax: number;
}

function Dial({ spec, dials, onChange }: { spec: DialSpec; dials: Dials; onChange: Props["setDial"] }) {
  const display = (dials[spec.key] as number) / spec.scale;
  return (
    <div className="grid grid-cols-[minmax(96px,auto)_1fr_58px] items-center gap-3 border-b border-hair py-1.5">
      <span className="text-[0.84rem] text-ink-2">
        {spec.label}
        {spec.sub && <span className="text-ink-3"> {spec.sub}</span>}
      </span>
      <Slider
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={[display]}
        onValueChange={(v) => onChange(spec.key, v[0] * spec.scale)}
        aria-label={spec.label}
      />
      <span className="text-right text-[0.84rem] font-semibold">{spec.fmt(display)}</span>
    </div>
  );
}

export function Assumptions({ dials, setDial, onReset, marketRate, marketInflation, propertyTax }: Props) {
  const [open, setOpen] = useState(false);
  const primary = DIAL_SPECS.filter((s) => !s.advanced);
  const advanced = DIAL_SPECS.filter((s) => s.advanced);

  return (
    <section className="mt-5 border-t border-hair-2 pt-[18px]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[1.1rem] font-bold">Assumptions</h2>
        <button onClick={onReset} className="border-b border-hair-2 text-[0.8rem] font-semibold text-ink-2 hover:border-ink hover:text-ink">
          Reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-1 gap-x-[26px] sm:grid-cols-2">
        {primary.map((s) => (
          <Dial key={s.key} spec={s} dials={dials} onChange={setDial} />
        ))}
      </div>

      <div className="grid grid-cols-[minmax(96px,auto)_1fr_58px] items-center gap-3 border-b border-hair py-1.5">
        <span className="text-[0.84rem] text-ink-2">
          Loan term <span className="text-ink-3">sets the payment</span>
        </span>
        <ToggleGroup
          type="single"
          value={String(dials.loanTermYears)}
          onValueChange={(v) => { if (v) setDial("loanTermYears", Number(v)); }}
          className="justify-self-start"
          aria-label="Loan term"
        >
          <ToggleGroupItem value="15">15 yr</ToggleGroupItem>
          <ToggleGroupItem value="30">30 yr</ToggleGroupItem>
        </ToggleGroup>
        <span />
      </div>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
        <CollapsibleTrigger className="flex items-center gap-1.5 py-2 text-[0.84rem] font-semibold text-ink-2 hover:text-ink">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          {advanced.length} more variables
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 grid grid-cols-1 gap-x-[26px] sm:grid-cols-2">
            {advanced.map((s) => (
              <Dial key={s.key} spec={s} dials={dials} onChange={setDial} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <p className="mt-3 border-t border-hair pt-2.5 text-[0.8rem] leading-relaxed text-ink-3">
        <b className="font-semibold text-ink-2">Set by the market, not you:</b> mortgage rate {pct(marketRate)}, inflation{" "}
        {pct(marketInflation)}, property tax {pct(propertyTax)}. Inflation reverts toward a 2% anchor on its own.
      </p>
    </section>
  );
}
