/**
 * Benchmark the TypeScript engine on the exact pixels the Python benchmark
 * used (bench/input.bin, bench/input_rgb.bin). Run python/scripts/benchmark.py
 * first, then:  npm run bench
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { boxBlurChannel, boxBlurNaiveChannel, gaussianChannel } from '../src/engine/filters'
import { makeImg, type Img } from '../src/engine/image'
import { applyStep } from '../src/engine/registry'
import { SPEC, defaultParams } from '../src/engine/spec'

const root = new URL('../../bench/', import.meta.url)

function readPlanes(name: string, planes: number) {
  const buf = readFileSync(new URL(name, root))
  const w = buf.readUInt32LE(0)
  const h = buf.readUInt32LE(4)
  const data = new Uint8Array(buf.buffer, buf.byteOffset + 8, w * h * planes)
  return { w, h, planes: Array.from({ length: planes }, (_, k) => data.slice(k * w * h, (k + 1) * w * h)) }
}

function timed(fn: () => unknown, repeat = 5): number {
  fn() // warm up the JIT
  let best = Infinity
  for (let i = 0; i < repeat; i++) {
    const t = performance.now()
    fn()
    best = Math.min(best, performance.now() - t)
  }
  return Math.round(best * 10) / 10
}

const gray = readPlanes('input.bin', 1)
const radii = [1, 2, 4, 7, 12, 20]
const blur = { naive: [] as number[], separable: [] as number[], sat: [] as number[] }
for (const r of radii) {
  const p = gray.planes[0]
  blur.naive.push(timed(() => boxBlurNaiveChannel(p, gray.w, gray.h, r), 2))
  blur.separable.push(timed(() => gaussianChannel(p, gray.w, gray.h, r / 3)))
  blur.sat.push(timed(() => boxBlurChannel(p, gray.w, gray.h, r)))
  console.error(`  blur r=${r}`, blur.naive.at(-1), blur.separable.at(-1), blur.sat.at(-1))
}

const rgb = readPlanes('input_rgb.bin', 3)
const small: Img = makeImg(rgb.w, rgb.h, rgb.planes)
const ops: Record<string, number> = {}
for (const op of SPEC.operations) {
  ops[op.id] = timed(() => applyStep(small, { op: op.id, params: defaultParams(op.id) }), 3)
  console.error(`  ${op.id.padEnd(20)} ${ops[op.id]} ms`)
}

const result = {
  engine: 'typescript',
  runtime: `Node ${process.versions.node} (V8 ${process.versions.v8})`,
  blur: { image: [gray.w, gray.h], radii, ms: blur },
  ops: { image: [rgb.w, rgb.h], ms: ops },
}
writeFileSync(new URL('typescript.json', root), JSON.stringify(result, null, 2) + '\n')
console.error('wrote bench/typescript.json')
