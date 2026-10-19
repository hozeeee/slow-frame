import type { PointerEvent as ReactPointerEvent } from 'react'
import type { OverlayTimeMarks } from '../../overlay'
import type { Bounds, SpeedRange, TrimRange } from '../../timeMap'
import { useRef, useState } from 'react'
import {
  clampRange,
  formatTime,
  freeSpanFor,
  gapAt,
  makeRange,
  MIN_RANGE_SECONDS,
  MIN_TRIM_SECONDS,
} from '../../timeMap'

const LONG_PRESS_MS = 420
const MOVE_SLOP = 8
const MIN_VISIBLE_SECONDS = 0.5
const MAX_ZOOM = 64
const TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600]

type Gesture
  /** 刚按下，尚未判定是点按、拖动浏览还是长按。 */
  = | { kind: 'pending', pointerId: number, x: number, time: number, rangeId: string | null, timer: number }
    | { kind: 'scrub', pointerId: number }
  /** 长按已触发，等待拖动来框选新区间。 */
    | { kind: 'armed', pointerId: number, x: number, time: number, bounds: Bounds }
    | { kind: 'create', pointerId: number, anchor: number, bounds: Bounds, initial: SpeedRange }
    | { kind: 'move' | 'start' | 'end', pointerId: number, x: number, time: number, moved: boolean, initial: SpeedRange, bounds: Bounds }
    | { kind: 'trim-start' | 'trim-end', pointerId: number, x: number, origin: number }

interface TimelineProps {
  duration: number
  currentTime: number
  ranges: SpeedRange[]
  trim: TrimRange
  selectedId: string | null
  onSeek: (time: number) => void
  onSelect: (id: string | null) => void
  onRangesChange: (update: (current: SpeedRange[]) => SpeedRange[]) => void
  onTrimChange: (patch: Partial<TrimRange>) => void
  /** 选中图层的显示时段与关键帧，在轨道下方单独一行标出。 */
  overlayMarks?: OverlayTimeMarks | null
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/**
 * 触屏时间轴：
 * - 点按定位播放头，拖动即拖拽浏览；
 * - 长按空白处后拖动框选新区间；
 * - 点按区间选中，选中后可拖动色块平移、拖动两侧把手调整起止；
 * - 轨道下方的把手调整时长裁剪；
 * - 双指捏合缩放，缩放后拖动刻度尺或缩略条平移视野。
 */
export function Timeline({ duration, currentTime, ranges, trim, selectedId, onSeek, onSelect, onRangesChange, onTrimChange, overlayMarks }: TimelineProps) {
  const areaRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const pointersRef = useRef(new Map<number, number>())
  const pinchRef = useRef<{ distance: number, zoom: number, anchorTime: number } | null>(null)
  const panRef = useRef<{ pointerId: number, x: number, start: number, moved: boolean } | null>(null)
  const [view, setView] = useState({ zoom: 1, start: 0 })
  const [bubble, setBubble] = useState<{ time: number, label: string } | null>(null)

  const maxZoom = Math.max(1, Math.min(MAX_ZOOM, duration / MIN_VISIBLE_SECONDS))
  const zoom = Math.min(view.zoom, maxZoom)
  const span = duration / zoom
  const clampStart = (start: number, visible = span) => clamp(start, 0, Math.max(0, duration - visible))
  const viewStart = clampStart(view.start)
  const pct = (time: number) => `${((time - viewStart) / span) * 100}%`
  const widthOf = (seconds: number) => `${(seconds / span) * 100}%`

  // 播放头移出可视范围时让视野跟随（只在播放头变化时调整，不干扰手动平移）。
  const [followedTime, setFollowedTime] = useState(currentTime)
  if (followedTime !== currentTime) {
    setFollowedTime(currentTime)
    if (zoom > 1 && (currentTime < viewStart || currentTime > viewStart + span))
      setView(current => ({ ...current, start: clampStart(currentTime - span * 0.15) }))
  }

  const rect = () => areaRef.current!.getBoundingClientRect()
  const timeAt = (clientX: number) => {
    const box = rect()
    return clamp(viewStart + ((clientX - box.left) / box.width) * span, 0, duration)
  }
  const deltaTime = (fromX: number, toX: number) => ((toX - fromX) / rect().width) * span

  const setZoom = (nextZoom: number, anchorTime: number, anchorFraction: number) => {
    const zoomValue = clamp(nextZoom, 1, maxZoom)
    const visible = duration / zoomValue
    setView({ zoom: zoomValue, start: clampStart(anchorTime - anchorFraction * visible, visible) })
  }

  const zoomBy = (factor: number) => {
    const anchor = currentTime >= viewStart && currentTime <= viewStart + span ? currentTime : viewStart + span / 2
    setZoom(zoom * factor, anchor, (anchor - viewStart) / span)
  }

  const cancelGesture = () => {
    const gesture = gestureRef.current
    if (gesture?.kind === 'pending')
      window.clearTimeout(gesture.timer)
    gestureRef.current = null
    setBubble(null)
  }

  const beginPinch = () => {
    const [a, b] = [...pointersRef.current.values()]
    pinchRef.current = { distance: Math.max(24, Math.abs(a - b)), zoom, anchorTime: timeAt((a + b) / 2) }
  }

  const updatePinch = () => {
    const pinch = pinchRef.current!
    const [a, b] = [...pointersRef.current.values()]
    const box = rect()
    setZoom(pinch.zoom * Math.max(24, Math.abs(a - b)) / pinch.distance, pinch.anchorTime, ((a + b) / 2 - box.left) / box.width)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, event.clientX)
    if (pointersRef.current.size === 2) {
      cancelGesture()
      beginPinch()
      return
    }
    if (pointersRef.current.size > 2 || gestureRef.current)
      return

    const pointerId = event.pointerId
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-hit]')
    const hit = target?.dataset.hit
    const range = ranges.find(item => item.id === target?.dataset.id)
    const time = timeAt(event.clientX)

    if (hit === 'trim-start' || hit === 'trim-end') {
      gestureRef.current = { kind: hit, pointerId, x: event.clientX, origin: hit === 'trim-start' ? trim.start : trim.end }
      return
    }
    if (range && (hit === 'range-start' || hit === 'range-end' || (hit === 'range' && range.id === selectedId))) {
      gestureRef.current = {
        kind: hit === 'range-start' ? 'start' : hit === 'range-end' ? 'end' : 'move',
        pointerId,
        x: event.clientX,
        time,
        moved: false,
        initial: range,
        bounds: freeSpanFor(range, ranges, duration),
      }
      return
    }

    const gap = range ? null : gapAt(time, ranges, duration)
    const timer = gap && gap.max - gap.min >= MIN_RANGE_SECONDS
      ? window.setTimeout(() => {
          const gesture = gestureRef.current
          if (gesture?.kind !== 'pending' || gesture.pointerId !== pointerId)
            return
          gestureRef.current = { kind: 'armed', pointerId, x: gesture.x, time: gesture.time, bounds: gap }
          navigator.vibrate?.(12)
          setBubble({ time: gesture.time, label: '拖动框选新区间' })
        }, LONG_PRESS_MS)
      : 0
    gestureRef.current = { kind: 'pending', pointerId, x: event.clientX, time, rangeId: range?.id ?? null, timer }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId))
      return
    pointersRef.current.set(event.pointerId, event.clientX)
    if (pinchRef.current) {
      if (pointersRef.current.size >= 2)
        updatePinch()
      return
    }
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId)
      return
    const time = timeAt(event.clientX)

    switch (gesture.kind) {
      case 'pending': {
        if (Math.abs(event.clientX - gesture.x) < MOVE_SLOP)
          return
        window.clearTimeout(gesture.timer)
        gestureRef.current = { kind: 'scrub', pointerId: gesture.pointerId }
        onSeek(time)
        setBubble({ time, label: formatTime(time) })
        return
      }
      case 'scrub': {
        onSeek(time)
        setBubble({ time, label: formatTime(time) })
        return
      }
      case 'armed':
      case 'create': {
        const create = gesture.kind === 'create'
          ? gesture
          : { kind: 'create' as const, pointerId: gesture.pointerId, anchor: gesture.time, bounds: gesture.bounds, initial: makeRange(gesture.time, gesture.time + MIN_RANGE_SECONDS) }
        gestureRef.current = create
        const { anchor, bounds, initial } = create
        const bounded = clamp(time, bounds.min, bounds.max)
        const start = Math.min(Math.min(anchor, bounded), bounds.max - MIN_RANGE_SECONDS)
        const end = Math.max(Math.max(anchor, bounded), start + MIN_RANGE_SECONDS)
        const next = clampRange({ ...initial, start, end }, duration)
        onRangesChange(current => current.some(item => item.id === initial.id)
          ? current.map(item => item.id === initial.id ? next : item)
          : [...current, next])
        onSelect(initial.id)
        setBubble({ time: bounded, label: `${formatTime(next.start)} – ${formatTime(next.end)}` })
        return
      }
      case 'move':
      case 'start':
      case 'end': {
        if (!gesture.moved && Math.abs(event.clientX - gesture.x) < MOVE_SLOP / 2)
          return
        gesture.moved = true
        const { initial, bounds } = gesture
        const delta = deltaTime(gesture.x, event.clientX)
        let next = initial
        if (gesture.kind === 'move') {
          const length = initial.end - initial.start
          const start = clamp(initial.start + delta, bounds.min, bounds.max - length)
          next = { ...initial, start, end: start + length }
        }
        else if (gesture.kind === 'start') {
          next = { ...initial, start: clamp(initial.start + delta, bounds.min, initial.end - MIN_RANGE_SECONDS) }
          onSeek(next.start)
        }
        else {
          next = { ...initial, end: clamp(initial.end + delta, initial.start + MIN_RANGE_SECONDS, bounds.max) }
          onSeek(next.end)
        }
        const clamped = clampRange(next, duration)
        onRangesChange(current => current.map(item => item.id === initial.id ? clamped : item))
        setBubble({
          time: gesture.kind === 'end' ? clamped.end : clamped.start,
          label: gesture.kind === 'move' ? `${formatTime(clamped.start)} – ${formatTime(clamped.end)}` : formatTime(gesture.kind === 'start' ? clamped.start : clamped.end),
        })
        return
      }
      case 'trim-start': {
        const start = clamp(gesture.origin + deltaTime(gesture.x, event.clientX), 0, trim.end - MIN_TRIM_SECONDS)
        onTrimChange({ start })
        onSeek(start)
        setBubble({ time: start, label: `开始 ${formatTime(start)}` })
        return
      }
      case 'trim-end': {
        const end = clamp(gesture.origin + deltaTime(gesture.x, event.clientX), trim.start + MIN_TRIM_SECONDS, duration)
        onTrimChange({ end })
        onSeek(end)
        setBubble({ time: end, label: `结束 ${formatTime(end)}` })
      }
    }
  }

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointersRef.current.delete(event.pointerId))
      return
    if (pinchRef.current) {
      if (pointersRef.current.size < 2)
        pinchRef.current = null
      return
    }
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId)
      return
    cancelGesture()
    if (cancelled)
      return
    if (gesture.kind === 'pending') {
      if (gesture.rangeId) {
        onSelect(gesture.rangeId)
      }
      else {
        onSelect(null)
        onSeek(gesture.time)
      }
    }
    else if (gesture.kind === 'armed' || (gesture.kind === 'move' && !gesture.moved)) {
      onSeek(gesture.time)
    }
  }

  const onRulerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    panRef.current = { pointerId: event.pointerId, x: event.clientX, start: viewStart, moved: false }
  }

  const onRulerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId || zoom <= 1)
      return
    if (!pan.moved && Math.abs(event.clientX - pan.x) < MOVE_SLOP)
      return
    pan.moved = true
    const start = pan.start - deltaTime(pan.x, event.clientX)
    setView(current => ({ ...current, start: clampStart(start) }))
  }

  const onRulerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    panRef.current = null
    if (pan && pan.pointerId === event.pointerId && !pan.moved)
      onSeek(timeAt(event.clientX))
  }

  const onMinimap = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.type === 'pointerdown')
      event.currentTarget.setPointerCapture(event.pointerId)
    else if (!event.currentTarget.hasPointerCapture(event.pointerId))
      return
    const box = event.currentTarget.getBoundingClientRect()
    const time = ((event.clientX - box.left) / box.width) * duration
    setView(current => ({ ...current, start: clampStart(time - span / 2) }))
  }

  const tickStep = TICK_STEPS.find(step => span / step <= 5) ?? TICK_STEPS.at(-1)!
  const ticks: number[] = []
  for (let tick = Math.ceil(viewStart / tickStep) * tickStep; tick <= viewStart + span + 1e-6; tick += tickStep)
    ticks.push(tick)
  const tickLabel = (time: number) => tickStep < 1 ? `${time.toFixed(1)}s` : formatTime(time, false)
  const selected = ranges.find(range => range.id === selectedId)

  return (
    <div className="m-timeline">
      <div className="m-tl-toolbar">
        <span>{zoom > 1 ? `缩放 ${zoom < 10 ? zoom.toFixed(1) : Math.round(zoom)}×` : '双指捏合可缩放'}</span>
        <div className="m-tl-zoom">
          <button type="button" aria-label="缩小时间轴" disabled={zoom <= 1} onClick={() => zoomBy(0.5)}>−</button>
          <button type="button" aria-label="放大时间轴" disabled={zoom >= maxZoom} onClick={() => zoomBy(2)}>+</button>
        </div>
      </div>
      {zoom > 1 && (
        <div className="m-tl-minimap" onPointerDown={onMinimap} onPointerMove={onMinimap}>
          {ranges.map(range => (
            <i key={range.id} className={range.speed > 1 ? 'fast' : ''} style={{ left: `${(range.start / duration) * 100}%`, width: `${((range.end - range.start) / duration) * 100}%` }} />
          ))}
          <b style={{ left: `${(currentTime / duration) * 100}%` }} />
          <span style={{ left: `${(viewStart / duration) * 100}%`, width: `${(span / duration) * 100}%` }} />
        </div>
      )}
      <div
        className="m-tl-ruler"
        onPointerDown={onRulerDown}
        onPointerMove={onRulerMove}
        onPointerUp={onRulerUp}
        onPointerCancel={() => {
          panRef.current = null
        }}
      >
        {ticks.map(tick => <span key={tick} style={{ left: pct(tick) }}>{tickLabel(tick)}</span>)}
      </div>
      <div
        ref={areaRef}
        className="m-tl-area"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={event => onPointerEnd(event, false)}
        onPointerCancel={event => onPointerEnd(event, true)}
        onContextMenu={event => event.preventDefault()}
      >
        <div className="m-tl-track">
          <div className="m-tl-fill" style={{ width: `${clamp((currentTime - viewStart) / span, 0, 1) * 100}%` }} />
          {ranges.map(range => (
            <div
              key={range.id}
              data-hit="range"
              data-id={range.id}
              className={`m-tl-range ${range.speed > 1 ? 'fast' : ''} ${range.id === selectedId ? 'selected' : ''}`}
              style={{ left: pct(range.start), width: widthOf(range.end - range.start) }}
            >
              <span>
                {range.speed}
                ×
              </span>
            </div>
          ))}
          <div className="m-tl-shade" style={{ left: 0, width: `${clamp((trim.start - viewStart) / span, 0, 1) * 100}%` }} />
          <div className="m-tl-shade" style={{ left: `${clamp((trim.end - viewStart) / span, 0, 1) * 100}%`, right: 0 }} />
          <i className="m-tl-trim-line" style={{ left: pct(trim.start) }} />
          <i className="m-tl-trim-line" style={{ left: pct(trim.end) }} />
          {selected && (
            <>
              <span data-hit="range-start" data-id={selected.id} className="m-tl-handle" style={{ left: pct(selected.start) }}><i /></span>
              <span data-hit="range-end" data-id={selected.id} className="m-tl-handle" style={{ left: pct(selected.end) }}><i /></span>
            </>
          )}
          <div className="m-tl-playhead" style={{ left: pct(currentTime) }} />
        </div>
        <div className="m-tl-grips">
          <span data-hit="trim-start" className="m-tl-grip start" style={{ left: pct(trim.start) }}>[</span>
          <span data-hit="trim-end" className="m-tl-grip end" style={{ left: pct(trim.end) }}>]</span>
        </div>
      </div>
      {overlayMarks && (
        <div className="m-tl-lane" aria-label="选中图层的显示时段与关键帧">
          <div className="m-tl-lane-span" style={{ left: pct(overlayMarks.start), width: widthOf(overlayMarks.end - overlayMarks.start) }} />
          <div className="m-tl-lane-head" style={{ left: pct(currentTime) }} />
          {overlayMarks.keyframes.map(time => (
            <button
              key={time}
              type="button"
              className={`m-tl-keyframe ${Math.abs(time - currentTime) < 1e-3 ? 'current' : ''}`}
              style={{ left: pct(time) }}
              aria-label={`跳到关键帧 ${formatTime(time)}`}
              onClick={() => onSeek(time)}
            >
              <i />
            </button>
          ))}
        </div>
      )}
      {bubble && (
        <div className="m-tl-bubble" style={{ left: `${clamp((bubble.time - viewStart) / span, 0.12, 0.88) * 100}%` }}>{bubble.label}</div>
      )}
      <p className="m-tl-hint">点按定位 · 拖动浏览 · 长按空白处再拖动新建区间 · 选中区间后拖两侧把手调整 · 拖底部 [ ] 裁剪首尾</p>
    </div>
  )
}
