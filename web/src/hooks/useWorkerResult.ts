import { useEffect, useRef, useState } from 'react'

/** Debounced `load`; stale results are dropped and the last one stays visible. */
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
