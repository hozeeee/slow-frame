import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CropRect } from '../timeMap'
import { useEffect, useRef, useState } from 'react'
import { clampCrop, MIN_CROP_PIXELS } from '../timeMap'

type CropHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

interface CropOverlayProps {
  videoWidth: number
  videoHeight: number
  crop: CropRect | null
  aspect: number | null
  editing: boolean
  onChange: (crop: CropRect) => void
}

export function CropOverlay({ videoWidth, videoHeight, crop, aspect, editing, onChange }: CropOverlayProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ handle: CropHandle, x: number, y: number, scale: number, initial: CropRect } | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

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
    if (!editing || event.button !== 0)
      return
    event.stopPropagation()
    event.preventDefault()
    dragRef.current = { handle, x: event.clientX, y: event.clientY, scale, initial: rect }
    layerRef.current?.setPointerCapture(event.pointerId)
  }

  const move = (event: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.scale <= 0)
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
      className={`crop-layer ${editing ? 'editing' : ''}`}
      onPointerMove={move}
      onPointerUp={() => {
        dragRef.current = null
      }}
      onPointerCancel={() => {
        dragRef.current = null
      }}
    >
      {(crop || editing) && scale > 0 && (
        <div className="crop-frame" style={{ left: (box.width - frameWidth) / 2, top: (box.height - frameHeight) / 2, width: frameWidth, height: frameHeight }}>
          <div
            className="crop-box"
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
                <i className="crop-grid" />
                {(['nw', 'ne', 'sw', 'se'] as const).map(handle => (
                  <span key={handle} className={`crop-handle ${handle}`} onPointerDown={event => begin(event, handle)} />
                ))}
                <em className="crop-size">
                  {rect.width}
                  {' '}
                  ×
                  {' '}
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
