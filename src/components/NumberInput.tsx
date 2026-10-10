import { useEffect, useRef, useState } from 'react'

interface NumberInputProps {
  value: number
  min: number
  max: number
  step: number
  className?: string
  ariaLabel?: string
  onCommit: (value: number) => void
}

export function NumberInput({ value, min, max, step, className, ariaLabel, onCommit }: NumberInputProps) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(3))))
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current)
      setDraft(String(Number(value.toFixed(3))))
  }, [value])

  const commit = () => {
    focusedRef.current = false
    const parsed = Number(draft)
    if (Number.isFinite(parsed))
      onCommit(parsed)
    setDraft(String(Number(value.toFixed(3))))
  }

  return (
    <input
      aria-label={ariaLabel}
      className={className}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onFocus={(event) => {
        focusedRef.current = true
        event.currentTarget.select()
      }}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter')
          event.currentTarget.blur()
        if (event.key === 'Escape') {
          setDraft(String(Number(value.toFixed(3))))
          event.currentTarget.blur()
        }
      }}
    />
  )
}
