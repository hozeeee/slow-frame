import { useEffect, useRef, useState } from 'react'

interface NumberFieldProps {
  value: number
  min: number
  max: number
  /** 点击 −/+ 的步长；长按会连续步进。 */
  step: number
  digits?: number
  unit?: string
  ariaLabel: string
  onCommit: (value: number) => void
}

const REPEAT_DELAY = 420
const REPEAT_INTERVAL = 70

/** 触屏数值输入：两侧大号 −/+ 按钮（支持长按连发），中间为输入完成后才提交的文本框。 */
export function NumberField({ value, min, max, step, digits = 3, unit, ariaLabel, onCommit }: NumberFieldProps) {
  const format = (next: number) => String(Number(next.toFixed(digits)))
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const latestRef = useRef(value)
  const repeatRef = useRef<{ delay: number, interval: number } | null>(null)

  useEffect(() => {
    latestRef.current = value
  }, [value])

  useEffect(() => () => stopRepeat(), [])

  const clamp = (next: number) => Math.max(min, Math.min(max, next))
  const shown = focused ? draft : format(value)

  const nudge = (direction: 1 | -1) => {
    const next = clamp(Number((latestRef.current + direction * step).toFixed(6)))
    latestRef.current = next
    onCommit(next)
  }

  function stopRepeat() {
    if (!repeatRef.current)
      return
    window.clearTimeout(repeatRef.current.delay)
    window.clearInterval(repeatRef.current.interval)
    repeatRef.current = null
  }

  const startRepeat = (direction: 1 | -1) => {
    stopRepeat()
    nudge(direction)
    const timers = { delay: 0, interval: 0 }
    timers.delay = window.setTimeout(() => {
      timers.interval = window.setInterval(nudge, REPEAT_INTERVAL, direction)
    }, REPEAT_DELAY)
    repeatRef.current = timers
  }

  const commit = () => {
    setFocused(false)
    const parsed = Number(draft.replace(',', '.'))
    if (draft.trim() !== '' && Number.isFinite(parsed))
      onCommit(clamp(parsed))
  }

  const stepButton = (direction: 1 | -1) => (
    <button
      type="button"
      className="m-num-step"
      aria-label={`${ariaLabel}${direction > 0 ? '增加' : '减少'}`}
      disabled={direction > 0 ? value >= max : value <= min}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        startRepeat(direction)
      }}
      onPointerUp={stopRepeat}
      onPointerCancel={stopRepeat}
      onLostPointerCapture={stopRepeat}
      onContextMenu={event => event.preventDefault()}
    >
      {direction > 0 ? '+' : '−'}
    </button>
  )

  return (
    <div className="m-num">
      {stepButton(-1)}
      <label className="m-num-value">
        <input
          aria-label={ariaLabel}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={shown}
          onFocus={(event) => {
            setDraft(format(value))
            setFocused(true)
            const input = event.currentTarget
            requestAnimationFrame(() => input.select())
          }}
          onChange={event => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter')
              event.currentTarget.blur()
          }}
        />
        {unit && <span>{unit}</span>}
      </label>
      {stepButton(1)}
    </div>
  )
}
