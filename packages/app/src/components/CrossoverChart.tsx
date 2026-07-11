import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Projection } from "@tb-ntb/model";
import { compact, money } from "@/lib/format";

const VB_W = 720, VB_H = 380, padL = 40, padR = 116, padT = 24, padB = 34;

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

export function CrossoverChart({ proj, exit, breakeven }: { proj: Projection; exit: number; breakeven: number | null }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const pts = proj.years.map((y) => ({ year: y.year, a: y.buyerNetWorth, b: y.renterNetWorth }));
  const H = pts.length;
  const yMax = niceMax(pts.reduce((mx, p) => Math.max(mx, p.a, p.b), 0));
  const plotW = VB_W - padL - padR, plotH = VB_H - padT - padB;
  const X = (yr: number) => padL + ((yr - 1) / (H - 1)) * plotW;
  const Y = (v: number) => padT + (1 - v / yMax) * plotH;

  const be = breakeven;
  const last = pts[H - 1];
  const exitP = pts[exit - 1];

  let yaE = Y(last.a), ybE = Y(last.b);
  if (Math.abs(yaE - ybE) < 30) { if (last.a >= last.b) { yaE -= 15; ybE += 15; } else { yaE += 15; ybE -= 15; } }

  const gap = Math.abs(exitP.a - exitP.b);
  const showGap = gap > yMax * 0.012 && exit !== be;
  const topY = Math.min(Y(exitP.a), Y(exitP.b)), botY = Math.max(Y(exitP.a), Y(exitP.b));
  const gapAnchor = exit >= H - 1 ? "end" : exit <= 1 ? "start" : "middle";

  const move = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * VB_W;
    setHover(Math.max(1, Math.min(H, Math.round(((px - padL) / plotW) * (H - 1)) + 1)));
  };
  const hv = hover ? pts[hover - 1] : null;

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        className="chart block h-auto w-full touch-none"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label="Net worth of Hannah and Ryan over ten years"
        onPointerMove={move}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((f) => {
          const yv = yMax * f, gy = Y(yv);
          return (
            <g key={f}>
              <line x1={padL} y1={gy} x2={padL + plotW} y2={gy} stroke={f === 0 ? "var(--hair-2)" : "var(--hair)"} strokeWidth={f === 0 ? 1.3 : 1} />
              <text x={padL - 6} y={gy - 3} textAnchor="start" fontSize={11} fill="var(--ink-3)">{compact(yv)}</text>
            </g>
          );
        })}
        {pts.map((p) => {
          const hi = p.year === 1 || p.year === H || p.year === exit;
          return (
            <text key={p.year} x={X(p.year)} y={padT + plotH + 18} textAnchor="middle" fontSize={11} fontWeight={hi ? 700 : 400} fill={hi ? "var(--ink)" : "var(--ink-3)"}>{p.year}</text>
          );
        })}
        <text x={padL + plotW / 2} y={padT + plotH + 32} textAnchor="middle" fontSize={11} fill="var(--ink-3)">years since buying</text>

        <polyline points={pts.map((p) => `${X(p.year)},${Y(p.b)}`).join(" ")} fill="none" stroke="var(--bob)" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={pts.map((p) => `${X(p.year)},${Y(p.a)}`).join(" ")} fill="none" stroke="var(--alice)" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />

        <text x={X(H) + 8} y={yaE - 2} fontSize={13} fontWeight={700} fill="var(--alice)">Hannah, buys</text>
        <text x={X(H) + 8} y={yaE + 12} fontSize={12} fill="var(--alice)">{compact(last.a)}</text>
        <text x={X(H) + 8} y={ybE - 2} fontSize={13} fontWeight={700} fill="var(--bob)">Ryan, rents</text>
        <text x={X(H) + 8} y={ybE + 12} fontSize={12} fill="var(--bob)">{compact(last.b)}</text>

        {be && be > 1 ? (
          <g>
            <circle cx={X(be)} cy={Y(pts[be - 1].a)} r={3.5} fill="var(--ink)" />
            <line x1={X(be)} y1={Y(pts[be - 1].a) - 6} x2={X(be)} y2={Y(pts[be - 1].a) - 24} stroke="var(--ink-3)" strokeWidth={1} />
            <text x={X(be)} y={Y(pts[be - 1].a) - 30} textAnchor="middle" fontSize={12} fill="var(--ink)">Hannah overtakes, year {be}</text>
          </g>
        ) : !be ? (
          <text x={X(H) + 8} y={yaE + 27} fontSize={11.5} fill="var(--ink-2)">never overtakes Ryan</text>
        ) : null}

        <circle cx={X(exit)} cy={Y(exitP.a)} r={3} fill="var(--alice)" />
        <circle cx={X(exit)} cy={Y(exitP.b)} r={3} fill="var(--bob)" />
        {showGap && (
          <g>
            <line x1={X(exit)} y1={topY} x2={X(exit)} y2={botY} stroke="var(--ink-3)" strokeWidth={1} />
            <line x1={X(exit) - 3} y1={topY} x2={X(exit) + 3} y2={topY} stroke="var(--ink-3)" strokeWidth={1} />
            <line x1={X(exit) - 3} y1={botY} x2={X(exit) + 3} y2={botY} stroke="var(--ink-3)" strokeWidth={1} />
            <text x={X(exit)} y={topY - 34} textAnchor={gapAnchor} fontSize={12} fill="var(--ink)">{compact(gap)} gap</text>
            <text x={X(exit)} y={topY - 20} textAnchor={gapAnchor} fontSize={11.5} fill="var(--ink-2)">at year {exit}</text>
          </g>
        )}

        {hv && (
          <g>
            <line x1={X(hv.year)} y1={padT} x2={X(hv.year)} y2={padT + plotH} stroke="var(--hair)" strokeWidth={1} />
            <circle cx={X(hv.year)} cy={Y(hv.a)} r={4} fill="var(--alice)" />
            <circle cx={X(hv.year)} cy={Y(hv.b)} r={4} fill="var(--bob)" />
          </g>
        )}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent" style={{ cursor: "crosshair" }} />
      </svg>

      {hv && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[114%] whitespace-nowrap rounded border border-hair-2 bg-panel px-2.5 py-1.5 text-[0.8rem] leading-snug"
          style={{ left: `${(X(hv.year) / VB_W) * 100}%`, top: `${(Math.min(Y(hv.a), Y(hv.b)) / VB_H) * 100}%` }}
        >
          <div className="mb-0.5 text-[0.7rem] font-semibold uppercase tracking-wide opacity-70">Year {hv.year}</div>
          <div><span className="font-semibold text-alice">Hannah</span> {money(hv.a)}</div>
          <div><span className="font-semibold text-bob">Ryan</span> {money(hv.b)}</div>
        </div>
      )}
    </div>
  );
}
