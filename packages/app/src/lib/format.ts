export const money = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

export const compact = (v: number) =>
  v >= 1e6
    ? "$" + (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 2) + "m"
    : v >= 1e3
      ? "$" + Math.round(v / 1e3) + "k"
      : "$" + Math.round(v);

export const pct = (v: number, d = 1) => (v * 100).toFixed(d) + "%";

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const M = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${M[m - 1]} ${d}, ${y}`;
}
