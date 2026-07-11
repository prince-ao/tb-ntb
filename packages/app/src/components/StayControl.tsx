import { Slider } from "@/components/ui/slider";

export function StayControl({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 border-y border-hair-2 py-3.5">
      <span className="text-[0.95rem] font-semibold text-ink">How long will you stay?</span>
      <Slider min={1} max={max} step={1} value={[value]} onValueChange={(v) => onChange(v[0])} aria-label="Years you will stay" />
      <span className="min-w-[62px] text-right text-[0.95rem] font-bold">
        {value} {value === 1 ? "year" : "years"}
      </span>
      <div className="col-span-full flex justify-between text-[0.7rem] text-ink-3">
        <span>1 year</span>
        <span>{max} years</span>
      </div>
    </div>
  );
}
