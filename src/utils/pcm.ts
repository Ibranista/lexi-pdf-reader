export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const SLICE = 0x8000;
  for (let i = 0; i < bytes.length; i += SLICE) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + SLICE)),
    );
  }
  return btoa(binary);
}

export function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    let code: number;
    if (b < 0x80) code = b;
    else if (b < 0xe0) code = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    else if (b < 0xf0)
      code =
        ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else
      code =
        ((b & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
    out += String.fromCodePoint(code);
  }
  return out;
}

export function rateOf(mimeType: string | undefined, fallback = 24000) {
  const match = /rate=(\d+)/.exec(mimeType ?? "");
  return match ? Number(match[1]) : fallback;
}

export function createResampler(to: number) {
  let from = 0;
  let prev = 0;
  let hasPrev = false;
  let cursor = 0;

  const reset = () => {
    from = 0;
    prev = 0;
    hasPrev = false;
    cursor = 0;
  };

  const push = (bytes: Uint8Array, rate: number): Uint8Array => {
    if (rate !== from) {
      reset();
      from = rate;
    }
    const input = new Int16Array(
      bytes.buffer,
      bytes.byteOffset,
      Math.floor(bytes.byteLength / 2),
    );
    if (rate === to) return bytes.slice(0, input.length * 2);
    if (!input.length) return new Uint8Array(0);

    const step = rate / to;
    const at = (i: number) => (i < 0 ? prev : input[i]);
    const out: number[] = [];
    if (!hasPrev && cursor < 0) cursor = 0;

    while (cursor <= input.length - 1) {
      const i = Math.floor(cursor);
      const frac = cursor - i;
      const next = i + 1 < input.length ? at(i + 1) : at(i);
      out.push(Math.round(at(i) * (1 - frac) + next * frac));
      cursor += step;
    }

    cursor -= input.length;
    prev = input[input.length - 1];
    hasPrev = true;

    return new Uint8Array(Int16Array.from(out).buffer);
  };

  return { push, reset };
}
