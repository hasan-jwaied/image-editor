import { useEffect, useRef, useState } from 'react'

/**
 * Runs `load` shortly after `key` (or `input`) stops changing, e.g. while a
 * slider is dragged, and ignores results that arrive after a newer request.
 * The previous result stays visible until the new one is ready.
 */
export function useWorkerResult<T>(load: () => Promise<T>, key: string, input: unknown, delay = 120): T | null {
  const [result, setResult] = useState<T | null>(null)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      loadRef.current().then(
        (value) => alive && setResult(value),
        () => alive && setResult(null),
      )
    }, delay)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [key, input, delay])

  return result
}
