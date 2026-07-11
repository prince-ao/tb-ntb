import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { ContractMetro } from "@/lib/contract";
import { filterMetros } from "@/lib/metro";
import { cn } from "@/lib/utils";

const CAP = 20;

// @spec APP-UI-001, APP-UI-008, APP-UI-009, APP-UI-010, APP-UI-011
export function MetroCombobox({
  metros,
  value,
  onChange,
}: {
  metros: ContractMetro[];
  value: string;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = metros.find((m) => m.slug === value);
  const { shown, total, capped } = useMemo(() => filterMetros(metros, query, CAP), [metros, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Choose a metro"
          className="flex min-w-[190px] max-w-[240px] items-center justify-between gap-2 rounded-md border border-hair-2 bg-panel px-3 py-[6px] text-[0.9rem] font-semibold text-ink"
        >
          <span className="truncate">{current ? current.name : "Select a metro"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[240px] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search metro or state…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No metro found.</CommandEmpty>
            {shown.map((m) => (
              <CommandItem
                key={m.slug}
                value={m.slug}
                onSelect={() => {
                  onChange(m.slug);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", m.slug === value ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{m.name}</span>
              </CommandItem>
            ))}
            {capped && (
              <p className="px-3 py-2 text-center text-[0.72rem] text-ink-3">
                Showing {CAP} of {total} — keep typing to narrow.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
