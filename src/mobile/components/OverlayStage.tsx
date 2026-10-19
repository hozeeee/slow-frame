import type { PointerEvent as ReactPointerEvent } from 'react'
import type { OverlayBox, OverlayHandle, OverlayLayer } from '../../overlay'
import type { FlipState } from '../../timeMap'
import { useRef, useState } from 'react'
import { clampBox, dragOverlayBox, resolveBox, toDisplayBox } from '../../overlay'
import { useStageFrame } from '../../useOverlayPreview'

/** 框在屏幕上小于这个尺寸（px）时只保留右下角把手，免得 44px 的把手热区把框体整个盖住、无法拖动。 */
const COMPACT_BOX = 72

interface OverlayStageProps {
  videoWidth: number
  videoHeight: number
  flip: FlipState
  /** 当前选中的图层；为空时不显示编辑框。 */
  layer: OverlayLayer | null
  currentTime: number
  /** 暂停且未在裁剪编辑时才允许拖动。 */
  active: boolean
  imageMissing: boolean
  /** 判断当前时间是否已有关键帧的容差（秒）。 */
  snap: number
  onChange: (box: OverlayBox) => void
  onRequestImage: () => void
}

/**
 * 触屏图层编辑框：单指拖动框体移动、拖动角把手缩放，变化自动打在当前时间的关键帧上。
 * 只跟踪第一根手指，其余手指忽略；角把手的触控热区放大到 44px。
 */
export function OverlayStage({ videoWidth, videoHeight, flip, layer, currentTime, active, imageMissing, snap, onChange, onRequestImage }: OverlayStageProps) {
  const { layerRef, frame } = useStageFrame(videoWidth, videoHeight)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ handle: OverlayHandle, pointerId: number, x: number, y: number, scale: number, initial: OverlayBox } | null>(null)
  const [dragging, setDragging] = useState<OverlayHandle | null>(null)

  const resolved = layer && active ? resolveBox(layer, currentTime) : null
  const display = resolved && toDisplayBox(resolved, flip, videoWidth, videoHeight)
  const onKeyframe = Boolean(layer?.keyframes.some(item => Math.abs(item.time - currentTime) <= snap))
  const compact = display ? Math.min(display.w, display.h) * frame.scale < COMPACT_BOX : false
  const handles: OverlayHandle[] = compact ? ['se'] : ['nw', 'ne', 'sw', 'se']

  const begin = (event: ReactPointerEvent, handle: OverlayHandle) => {
    event.stopPropagation()
    if (!display || !event.isPrimary || dragRef.current)
      return
    event.preventDefault()
    dragRef.current = { handle, pointerId: event.pointerId, x: event.clientX, y: event.clientY, scale: frame.scale, initial: display }
    setDragging(handle)
    boxRef.current?.setPointerCapture(event.pointerId)
  }

  const move = (event: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || drag.scale <= 0 || !layer)
      return
    event.stopPropagation()
    // 在镜像后的显示坐标里计算，屏幕位移除以缩放得到原视频像素；再按镜像换回原视频坐标。
    const next = dragOverlayBox(drag.initial, drag.handle, (event.clientX - drag.x) / drag.scale, (event.clientY - drag.y) / drag.scale, layer.kind === 'image')
    onChange(clampBox(toDisplayBox(next, flip, videoWidth, videoHeight), videoWidth, videoHeight))
  }

  const finish = (event: ReactPointerEvent) => {
    if (dragRef.current?.pointerId !== event.pointerId)
      return
    event.stopPropagation()
    dragRef.current = null
    setDragging(null)
  }

  const hint = layer && active && !resolved ? '当前时间不在该图层显示时段' : null

  return (
    <div ref={layerRef} className="m-overlay-stage">
      {display && frame.scale > 0 && (
        <div className="m-overlay-stage-frame" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}>
          <div
            ref={boxRef}
            className={`m-overlay-box ${dragging ? 'active' : ''}`}
            style={{
              left: `${(display.x / videoWidth) * 100}%`,
              top: `${(display.y / videoHeight) * 100}%`,
              width: `${(display.w / videoWidth) * 100}%`,
              height: `${(display.h / videoHeight) * 100}%`,
            }}
            onPointerDown={event => begin(event, 'move')}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={finish}
            onClick={event => event.stopPropagation()}
            onContextMenu={event => event.preventDefault()}
          >
            {imageMissing && (
              <button
                type="button"
                className="m-overlay-missing"
                onPointerDown={event => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onRequestImage()
                }}
              >
                图片缺失，点此选择
              </button>
            )}
            {handles.map(handle => (
              <span key={handle} className={`m-overlay-handle ${handle} ${dragging === handle ? 'active' : ''}`} onPointerDown={event => begin(event, handle)}><i /></span>
            ))}
            <em className={`m-overlay-tag ${onKeyframe ? 'keyframe' : ''}`}>{onKeyframe ? '◆ 关键帧' : '◇ 拖动新增关键帧'}</em>
          </div>
        </div>
      )}
      {hint && <div className="m-overlay-stage-hint">{hint}</div>}
    </div>
  )
}
