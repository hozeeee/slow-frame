import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CropRect } from '../../timeMap'
import { useEffect, useRef, useState } from 'react'
import { clampCrop, MIN_CROP_PIXELS } from '../../timeMap'

type CropHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

interface CropOverlayProps {
  videoWidth: number
  videoHeight: number
  crop: CropRect | null
  aspect: number | null
  editing: boolean
  onChange: (crop: CropRect) => void
}

/** 触屏裁剪框：四角为大尺寸触控热区，只跟随第一根手指，避免多指误触。 */
export function CropOverlay({ videoWidth, videoHeight, crop, aspect, editing, onChange }: CropOverlayProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number, handle: CropHandle, x: number, y: number, scale: number, initial: CropRect } | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [active, setActive] = useState<CropHandle | null>(null)

  useEffect(() => {
    const node = layerRef.current
    if (!node)
      return
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const scale = Math.min(box.width / videoWidth, box.height / videoHeight) || 0
  const frameWidth = videoWidth * scale
  const frameHeight = videoHeight * scale
  const rect = crop ?? { left: 0, top: 0, width: videoWidth, height: videoHeight }

  const begin = (event: ReactPointerEvent, handle: CropHandle) => {
    if (!editing || dragRef.current)
      return
    event.stopPropagation()
    event.preventDefault()
    dragRef.current = { pointerId: event.pointerId, handle, x: event.clientX, y: event.clientY, scale, initial: rect }
    layerRef.current?.setPointerCapture(event.pointerId)
    setActive(handle)
  }

  const end = (event: ReactPointerEvent) => {
    if (dragRef.current?.pointerId !== event.pointerId)
      return
    dragRef.current = null
    setActive(null)
  }

  const move = (event: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || drag.scale <= 0)
      return
    const dx = (event.clientX - drag.x) / drag.scale
    const dy = (event.clientY - drag.y) / drag.scale
    const initial = drag.initial

    if (drag.handle === 'move') {
      onChange(clampCrop({
        ...initial,
        left: Math.max(0, Math.min(videoWidth - initial.width, initial.left + dx)),
        top: Math.max(0, Math.min(videoHeight - initial.height, initial.top + dy)),
      }, videoWidth, videoHeight))
      return
    }

    const signX = drag.handle.includes('w') ? -1 : 1
    const signY = drag.handle.includes('n') ? -1 : 1
    const anchorX = signX > 0 ? initial.left : initial.left + initial.width
    const anchorY = signY > 0 ? initial.top : initial.top + initial.height
    const maxWidth = signX > 0 ? videoWidth - anchorX : anchorX
    const maxHeight = signY > 0 ? videoHeight - anchorY : anchorY
    let width = Math.max(MIN_CROP_PIXELS, Math.min(maxWidth, initial.width + signX * dx))
    let height = Math.max(MIN_CROP_PIXELS, Math.min(maxHeight, initial.height + signY * dy))
    if (aspect) {
      width = Math.min(Math.max(width, height * aspect), maxWidth, maxHeight * aspect)
      height = width / aspect
    }
    onChange(clampCrop({
      left: signX > 0 ? anchorX : anchorX - width,
      top: signY > 0 ? anchorY : anchorY - height,
      width,
      height,
    }, videoWidth, videoHeight))
  }

  return (
    <div
      ref={layerRef}
      className={`m-crop-layer ${editing ? 'editing' : ''}`}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {(crop || editing) && scale > 0 && (
        <div className="m-crop-frame" style={{ left: (box.width - frameWidth) / 2, top: (box.height - frameHeight) / 2, width: frameWidth, height: frameHeight }}>
          <div
            className={`m-crop-box ${active ? 'active' : ''}`}
            style={{
              left: `${(rect.left / videoWidth) * 100}%`,
              top: `${(rect.top / videoHeight) * 100}%`,
              width: `${(rect.width / videoWidth) * 100}%`,
              height: `${(rect.height / videoHeight) * 100}%`,
            }}
            onPointerDown={event => begin(event, 'move')}
          >
            {editing && (
              <>
                <i className="m-crop-grid" />
                {(['nw', 'ne', 'sw', 'se'] as const).map(handle => (
                  <span key={handle} className={`m-crop-handle ${handle} ${active === handle ? 'active' : ''}`} onPointerDown={event => begin(event, handle)}><i /></span>
                ))}
                <em className="m-crop-size">
                  {rect.width}
                  {' × '}
                  {rect.height}
                </em>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
