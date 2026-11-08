import { useEffect, useState } from 'react'

/** Delay expensive derived computations, while keeping the input itself responsive. */
const useDebouncedValue = <T,>(value: T, delay = 180): T => {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])

  return settled
}

export default useDebouncedValue
