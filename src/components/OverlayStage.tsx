import type { PointerEvent as ReactPointerEvent } from 'react'
import type { OverlayBox, OverlayHandle, OverlayLayer } from '../overlay'
import type { FlipState } from '../timeMap'
import { useRef, useState } from 'react'
import { clampBox, dragOverlayBox, resolveBox, toDisplayBox } from '../overlay'
import { useStageFrame } from '../useOverlayPreview'

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

/** 选中图层的交互层：拖动框体移动、拖动四角缩放，变化会自动打在当前时间的关键帧上。 */
export function OverlayStage({ videoWidth, videoHeight, flip, layer, currentTime, active, imageMissing, snap, onChange, onRequestImage }: OverlayStageProps) {
  const { layerRef, frame } = useStageFrame(videoWidth, videoHeight)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ handle: OverlayHandle, pointerId: number, x: number, y: number, scale: number, initial: OverlayBox } | null>(null)
  const [dragging, setDragging] = useState<OverlayHandle | null>(null)

  const resolved = layer && active ? resolveBox(layer, currentTime) : null
  const display = resolved && toDisplayBox(resolved, flip, videoWidth, videoHeight)
  const onKeyframe = Boolean(layer?.keyframes.some(item => Math.abs(item.time - currentTime) <= snap))

  const begin = (event: ReactPointerEvent, handle: OverlayHandle) => {
    if (!display || event.button !== 0 || dragRef.current)
      return
    event.stopPropagation()
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
    // 在镜像后的显示坐标里计算，屏幕位移除以缩放得到原视频像素。
    const next = dragOverlayBox(drag.initial, drag.handle, (event.clientX - drag.x) / drag.scale, (event.clientY - drag.y) / drag.scale, layer.kind === 'image')
    // 镜像换算是对合变换：把镜像后的框换回原视频坐标。
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
    <div ref={layerRef} className="overlay-stage">
      {display && frame.scale > 0 && (
        <div className="overlay-stage-frame" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}>
          <div
            ref={boxRef}
            className={`overlay-box ${dragging ? 'active' : ''}`}
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
          >
            {imageMissing && (
              <button
                type="button"
                className="overlay-missing"
                onPointerDown={event => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onRequestImage()
                }}
              >
                图片缺失，点此重新选择
              </button>
            )}
            {(['nw', 'ne', 'sw', 'se'] as const).map(handle => (
              <span key={handle} className={`overlay-handle ${handle} ${dragging === handle ? 'active' : ''}`} onPointerDown={event => begin(event, handle)} />
            ))}
            <em className={`overlay-tag ${onKeyframe ? 'keyframe' : ''}`}>{onKeyframe ? '◆ 关键帧' : '◇ 拖动将新增关键帧'}</em>
          </div>
        </div>
      )}
      {hint && <div className="overlay-stage-hint">{hint}</div>}
    </div>
  )
}
