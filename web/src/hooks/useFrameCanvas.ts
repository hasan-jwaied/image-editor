import { useLayoutEffect, useRef } from 'react'
import type { Frame } from '../components/Viewer'

/** A canvas ref that always shows `frame` at its native resolution (CSS scales it). */
export function useFrameCanvas(frame: Frame | null) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas || !frame) return
    if (canvas.width !== frame.width) canvas.width = frame.width
    if (canvas.height !== frame.height) canvas.height = frame.height
    canvas.getContext('2d')?.putImageData(new ImageData(frame.rgba, frame.width, frame.height), 0, 0)
  }, [frame])
  return ref
}
