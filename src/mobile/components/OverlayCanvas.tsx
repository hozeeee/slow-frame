import type { RefObject } from 'react'
import type { OverlayLayer } from '../../overlay'
import type { FlipState } from '../../timeMap'
import { useOverlayPreview } from '../../useOverlayPreview'

interface OverlayCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>
  videoWidth: number
  videoHeight: number
  flip: FlipState
  overlays: OverlayLayer[]
  images: ReadonlyMap<string, ImageBitmap>
  currentTime: number
  playing: boolean
}

/** 舞台上的图层画布：盖在视频画面上，只负责绘制，不拦截点按（点按画面仍是播放 / 暂停）。 */
export function OverlayCanvas(props: OverlayCanvasProps) {
  const { layerRef, canvasRef, frame, active } = useOverlayPreview(props)
  return (
    <div ref={layerRef} className="m-overlay-canvas">
      <canvas
        ref={canvasRef}
        style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height, visibility: active ? 'visible' : 'hidden' }}
      />
    </div>
  )
}
