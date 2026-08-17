export const READ_WIDTH_PX: Record<string, number> = {
  narrow: 40,
  comfort: 22,
  full: 12,
};

export function fontStack(fam: string): string {
  if (fam === 'serif') return "'Literata', Georgia, 'Times New Roman', serif";
  if (fam === 'dys')
    return "'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif";
  if (fam === 'comic')
    return "'Comic Relief', 'Comic Sans MS', 'Chalkboard SE', cursive";
  return "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
}

export function hexToRgb(color: string): [number, number, number] | null {
  const hex = color.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (full.length < 6) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
}

export function softInk(ink: string, page: string, amount: number): string {
  const a = hexToRgb(ink);
  const b = hexToRgb(page);
  if (!a || !b) return ink;
  const mix = (i: number) => Math.round(a[i] + (b[i] - a[i]) * amount);
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`;
}
