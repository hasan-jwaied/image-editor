/**
 * Numeric helpers. `roundHalfEven` reproduces Python's built-in `round`,
 * which rounds exact halves to the nearest even integer. Using it everywhere
 * the Python reference calls `round` is what lets the golden tests demand
 * bit-identical output.
 */
export function roundHalfEven(x: number): number {
  const r = Math.round(x) // rounds halves toward +Infinity
  return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r
}

/** Index lookup for clamp-to-edge borders: `idx[i + pad]` = clamp(i, 0, n-1). */
export function clampedIndex(n: number, pad: number): Int32Array {
  const idx = new Int32Array(n + 2 * pad)
  for (let i = 0; i < idx.length; i++) idx[i] = Math.min(n - 1, Math.max(0, i - pad))
  return idx
}

/**
 * Summed-area table of a plane with clamp-to-edge padding `pad`, plus a
 * leading row and column of zeros. Dimensions (h + 2p + 1) x (w + 2p + 1).
 * Float64 keeps sums exact well past 2^31 (large images, big radii).
 */
export function integralImage(plane: Uint8Array, width: number, height: number, pad = 0): Float64Array {
  const pw = width + 2 * pad
  const ph = height + 2 * pad
  const stride = pw + 1
  const table = new Float64Array((ph + 1) * stride)
  const xi = clampedIndex(width, pad)
  const yi = clampedIndex(height, pad)
  for (let y = 0; y < ph; y++) {
    const src = yi[y] * width
    const row = (y + 1) * stride
    const prev = y * stride
    let running = 0
    for (let x = 0; x < pw; x++) {
      running += plane[src + xi[x]]
      table[row + x + 1] = table[prev + x + 1] + running
    }
  }
  return table
}
