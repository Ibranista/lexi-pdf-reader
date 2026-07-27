/**
 * Typography shared by everything that reflows text into a WebView — the PDF
 * reflow reader and the web book reader. Both read the same "reading comfort"
 * settings, so the mapping from setting to CSS lives here rather than in
 * whichever reader happened to need it first.
 */

/** Reading-width setting → body side padding. Narrow leaves more margin. */
export const READ_WIDTH_PX: Record<string, number> = {
  narrow: 40,
  comfort: 22,
  full: 12,
};

/** Same family map as the prototype: Literata / Hanken Grotesk / Atkinson
 *  Hyperlegible, with system fallbacks while the webfonts load. */
export function fontStack(fam: string): string {
  if (fam === 'serif') return "'Literata', Georgia, 'Times New Roman', serif";
  if (fam === 'dys')
    return "'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif";
  return "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
}

/** #rrggbb / #rgb → [r,g,b], or null if it isn't a plain hex color. */
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

/**
 * "Soft" contrast: blend the reader ink a fraction of the way toward the page
 * colour so text sits a touch lighter against the background. Falls back to the
 * ink unchanged if either colour isn't a plain hex.
 */
export function softInk(ink: string, page: string, amount: number): string {
  const a = hexToRgb(ink);
  const b = hexToRgb(page);
  if (!a || !b) return ink;
  const mix = (i: number) => Math.round(a[i] + (b[i] - a[i]) * amount);
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`;
}
