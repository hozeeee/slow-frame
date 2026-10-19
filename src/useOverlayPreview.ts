import type { RefObject } from 'react'
import type { OverlayLayer } from './overlay'
import type { FlipState } from './timeMap'
import { useEffect, useRef, useState } from 'react'
import { drawOverlays, visibleOverlays } from './overlay'

/** 视频按 contain 方式显示时，画面在容器里的位置与尺寸。 */
export interface StageFrame {
  left: number
  top: number
  width: number
  height: number
  /** 屏幕像素 / 原视频像素。 */
  scale: number
}

/** 监听容器尺寸，计算视频画面（contain）在容器里的位置；两端的图层画布和编辑框共用。 */
export function useStageFrame(videoWidth: number, videoHeight: number) {
  const layerRef = useRef<HTMLDivElement>(null)
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
  const width = videoWidth * scale
  const height = videoHeight * scale
  const frame: StageFrame = { left: (box.width - width) / 2, top: (box.height - height) / 2, width, height, scale }
  return { layerRef, frame }
}

interface OverlayPreviewOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  videoWidth: number
  videoHeight: number
  flip: FlipState
  overlays: OverlayLayer[]
  images: ReadonlyMap<string, ImageBitmap>
  currentTime: number
  playing: boolean
}

/**
 * 预览图层的绘制循环：与导出共用同一个绘制函数。
 * 播放时按 video.currentTime 逐帧绘制，暂停时使用编辑器的当前时间；没有图层时不启动循环。
 */
export function useOverlayPreview({ videoRef, videoWidth, videoHeight, flip, overlays, images, currentTime, playing }: OverlayPreviewOptions) {
  const { layerRef, frame } = useStageFrame(videoWidth, videoHeight)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestRef = useRef({ flip, overlays, images, currentTime, playing })
  const active = overlays.length > 0 && frame.width > 0 && frame.height > 0

  useEffect(() => {
    latestRef.current = { flip, overlays, images, currentTime, playing }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !active)
      return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const width = Math.max(1, Math.round(frame.width * dpr))
    const height = Math.max(1, Math.round(frame.height * dpr))
    canvas.width = width
    canvas.height = height
    let animationFrame = 0

    const draw = () => {
      const state = latestRef.current
      const video = videoRef.current
      const time = state.playing && video ? video.currentTime : state.currentTime
      context.clearRect(0, 0, width, height)
      const visible = visibleOverlays(state.overlays, time)
      if (visible.length) {
        // 马赛克需要从画面取样：先把（镜像后的）视频画进画布，再以画布自身作为取样来源，与导出一致。
        if (video && video.readyState >= 2 && visible.some(item => item.layer.kind === 'mosaic')) {
          context.save()
          context.translate(state.flip.horizontal ? width : 0, state.flip.vertical ? height : 0)
          context.scale(state.flip.horizontal ? -1 : 1, state.flip.vertical ? -1 : 1)
          context.drawImage(video, 0, 0, width, height)
          context.restore()
        }
        drawOverlays(context, canvas, state.overlays, time, {
          flip: state.flip,
          width: videoWidth,
          height: videoHeight,
          offsetX: 0,
          offsetY: 0,
          scale: width / videoWidth,
          images: state.images,
        })
      }
      animationFrame = requestAnimationFrame(draw)
    }

    animationFrame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animationFrame)
      context.clearRect(0, 0, width, height)
    }
  }, [active, frame.width, frame.height, videoWidth, videoHeight, videoRef])

  return { layerRef, canvasRef, frame, active }
}
