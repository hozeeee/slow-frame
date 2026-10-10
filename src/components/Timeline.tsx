import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Bounds, SpeedRange, TrimRange } from '../timeMap'
import { useRef } from 'react'
import {

  clampRange,
  formatTime,
  freeSpanFor,
  gapAt,
  makeRange,
  MIN_RANGE_SECONDS,

} from '../timeMap'

interface DragState {
  kind: 'create' | 'move' | 'start' | 'end'
  id: string
  anchorTime: number
  anchorX: number
  hasMoved: boolean
  initial: SpeedRange
  bounds: Bounds | null
}

interface TimelineProps {
  duration: number
  currentTime: number
  ranges: SpeedRange[]
  trim: TrimRange
  selectedId: string | null
  onSeek: (time: number) => void
  onSelect: (id: string) => void
  onRangesChange: (ranges: SpeedRange[]) => void
  onTrimChange: (patch: Partial<TrimRange>) => void
}

export function Timeline({ duration, currentTime, ranges, trim, selectedId, onSeek, onSelect, onRangesChange, onTrimChange }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const trimDragRef = useRef<'start' | 'end' | null>(null)
  const percent = (time: number) => `${(time / duration) * 100}%`

  const eventTime = (event: ReactPointerEvent) => {
    const rect = trackRef.current!.getBoundingClientRect()
    return Math.max(0, Math.min(duration, ((event.clientX - rect.left) / rect.width) * duration))
  }

  const beginCreate = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget)
      return
    const time = eventTime(event)
    const range = makeRange(time, Math.min(duration, time + MIN_RANGE_SECONDS))
    const gap = gapAt(time, ranges, duration)
    dragRef.current = {
      kind: 'create',
      id: range.id,
      anchorTime: time,
      anchorX: event.clientX,
      hasMoved: false,
      initial: range,
      bounds: gap && gap.max - gap.min >= MIN_RANGE_SECONDS ? gap : null,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const beginRangeDrag = (event: ReactPointerEvent, range: SpeedRange, kind: DragState['kind']) => {
    event.stopPropagation()
    dragRef.current = {
      kind,
      id: range.id,
      anchorTime: eventTime(event),
      anchorX: event.clientX,
      hasMoved: true,
      initial: range,
      bounds: freeSpanFor(range, ranges, duration),
    }
    onSelect(range.id)
    trackRef.current?.setPointerCapture(event.pointerId)
  }

  const beginTrimDrag = (event: ReactPointerEvent, edge: 'start' | 'end') => {
    event.stopPropagation()
    if (event.button !== 0)
      return
    trimDragRef.current = edge
    trackRef.current?.setPointerCapture(event.pointerId)
  }

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!trimDragRef.current && !dragRef.current)
      return
    const time = eventTime(event)
    if (trimDragRef.current === 'start') {
      const start = Math.max(0, Math.min(time, trim.end - 0.1))
      onTrimChange({ start })
      onSeek(start)
      return
    }
    if (trimDragRef.current === 'end') {
      const end = Math.min(duration, Math.max(time, trim.start + 0.1))
      onTrimChange({ end })
      onSeek(end)
      return
    }

    const drag = dragRef.current
    if (!drag)
      return
    const delta = time - drag.anchorTime
    const bounds = drag.bounds
    let next = drag.initial

    if (drag.kind === 'create') {
      if (!bounds)
        return
      if (!drag.hasMoved && Math.abs(event.clientX - drag.anchorX) < 4)
        return
      drag.hasMoved = true
      const bounded = Math.max(bounds.min, Math.min(bounds.max, time))
      const start = Math.min(Math.min(drag.anchorTime, bounded), bounds.max - MIN_RANGE_SECONDS)
      const end = Math.max(Math.max(drag.anchorTime, bounded), start + MIN_RANGE_SECONDS)
      next = { ...next, start, end }
      const exists = ranges.some(range => range.id === drag.id)
      onRangesChange(exists
        ? ranges.map(range => range.id === drag.id ? clampRange(next, duration) : range)
        : [...ranges, clampRange(next, duration)])
      onSelect(drag.id)
      return
    }

    const min = bounds?.min ?? 0
    const max = bounds?.max ?? duration
    if (drag.kind === 'move') {
      const length = drag.initial.end - drag.initial.start
      const start = Math.max(min, Math.min(max - length, drag.initial.start + delta))
      next = { ...next, start, end: start + length }
    }
    else if (drag.kind === 'start') {
      next = { ...next, start: Math.max(min, Math.min(drag.initial.end - MIN_RANGE_SECONDS, time)) }
    }
    else {
      next = { ...next, end: Math.min(max, Math.max(drag.initial.start + MIN_RANGE_SECONDS, time)) }
    }
    onRangesChange(ranges.map(range => range.id === drag.id ? clampRange(next, duration) : range))
  }

  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (trimDragRef.current) {
      trimDragRef.current = null
      return
    }
    const drag = dragRef.current
    if (!drag) {
      onSeek(eventTime(event))
      return
    }
    dragRef.current = null
    if (drag.kind === 'create' && !drag.hasMoved)
      onSeek(drag.anchorTime)
  }

  const tickCount = Math.max(4, Math.min(10, Math.floor(duration / 5)))
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => (duration * index) / tickCount)

  return (
    <div className="timeline-shell">
      <div className="timeline-ruler">
        {ticks.map(tick => <span key={tick} style={{ left: percent(tick) }}>{formatTime(tick, false)}</span>)}
      </div>
      <div ref={trackRef} className="timeline-track" onPointerDown={beginCreate} onPointerMove={move} onPointerUp={finish}>
        <div className="timeline-fill" style={{ width: percent(currentTime) }} />
        {ranges.map(range => (
          <div
            key={range.id}
            className={`range-block ${range.id === selectedId ? 'selected' : ''} ${range.speed > 1 ? 'fast' : ''}`}
            style={{ left: percent(range.start), width: percent(range.end - range.start) }}
            title={range.name || undefined}
            onPointerDown={event => beginRangeDrag(event, range, 'move')}
          >
            <button aria-label="调整开始时间" className="range-handle left" onPointerDown={event => beginRangeDrag(event, range, 'start')} />
            <span>
              {range.speed}
              ×
            </span>
            <button aria-label="调整结束时间" className="range-handle right" onPointerDown={event => beginRangeDrag(event, range, 'end')} />
          </div>
        ))}
        <div className="trim-shade" style={{ left: 0, width: percent(trim.start) }} />
        <div className="trim-shade" style={{ left: percent(trim.end), right: 0 }} />
        <button aria-label="拖动调整导出开始时间" title="导出开始" className="trim-handle start" style={{ left: percent(trim.start) }} onPointerDown={event => beginTrimDrag(event, 'start')} />
        <button aria-label="拖动调整导出结束时间" title="导出结束" className="trim-handle end" style={{ left: percent(trim.end) }} onPointerDown={event => beginTrimDrag(event, 'end')} />
        <div className="playhead" style={{ left: percent(currentTime) }}><i /></div>
      </div>
      <div className="timeline-hint">拖动空白处新建区间 · 拖动色块移动 · 拖动两侧调整长度 · 拖动两端黑色把手裁剪首尾</div>
    </div>
  )
}
