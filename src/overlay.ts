import type { MediaInfo } from './media'
import type { FlipState } from './timeMap'

export type OverlayKind = 'text' | 'emoji' | 'image' | 'mosaic' | 'solid'
/** 关键帧之间的过渡：linear 平滑移动，hold 停在上一帧直到下一个关键帧。 */
export type OverlayEasing = 'linear' | 'hold'

/** 图层框，使用未镜像的原视频显示像素坐标。 */
export interface OverlayBox {
  x: number
  y: number
  w: number
  h: number
}

export interface OverlayKeyframe extends OverlayBox {
  /** 原视频时间（秒），与变速区间使用同一时间坐标。 */
  time: number
}

export interface OverlayLayer {
  id: string
  /** 用户自定义名称；为空时界面回退为“文字 1”这类默认名。 */
  name?: string
  kind: OverlayKind
  /** 显示时段（原视频秒数），首尾都包含。 */
  start: number
  end: number
  easing: OverlayEasing
  opacity: number
  /** 按时间升序排列，至少 1 个。 */
  keyframes: OverlayKeyframe[]
  /** 文字内容，或 emoji 字符。 */
  text?: string
  /** 文字或色块颜色，#rrggbb。 */
  color?: string
  /** 文字 / emoji 是否描边。 */
  outline?: boolean
  /** 图片图层引用的图片 id；图片本身只保存在缓存里。 */
  imageId?: string
  /** 马赛克块大小（原视频像素）。 */
  mosaicSize?: number
}

export interface OverlayImage {
  blob: Blob
  bitmap: ImageBitmap
}

/** 界面可直接修改的图层属性；显示时段与关键帧有各自的专用方法。 */
export type OverlayPatch = Partial<Pick<OverlayLayer, 'name' | 'easing' | 'opacity' | 'text' | 'color' | 'outline' | 'mosaicSize'>>

/** 界面显示的图层名称。 */
export function overlayName(layer: OverlayLayer): string {
  return layer.name || kindLabel(layer.kind)
}

export interface OverlayTimeMarks {
  start: number
  end: number
  keyframes: number[]
}

export const MAX_OVERLAYS = 20
export const MIN_OVERLAY_PIXELS = 8
export const MIN_OVERLAY_SECONDS = 0.05
export const MAX_OVERLAY_TEXT = 100
export const MIN_MOSAIC_SIZE = 4
export const MAX_MOSAIC_SIZE = 64
export const DEFAULT_MOSAIC_SIZE = 16
export const MAX_IMAGE_SIDE = 1024
export const EMOJI_PRESETS = ['😀', '😎', '🙈', '🐱', '⭐', '❤️', '🔥', '👍']
export const OVERLAY_KINDS: ReadonlyArray<{ kind: OverlayKind, label: string, icon: string }> = [
  { kind: 'text', label: '文字', icon: 'T' },
  { kind: 'emoji', label: 'Emoji', icon: '☺' },
  { kind: 'image', label: '图片', icon: '▣' },
  { kind: 'mosaic', label: '马赛克', icon: '▦' },
  { kind: 'solid', label: '色块', icon: '■' },
]

const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
const TIME_EPSILON = 1e-6

export function kindLabel(kind: OverlayKind): string {
  return OVERLAY_KINDS.find(item => item.kind === kind)?.label ?? kind
}

export function kindIcon(kind: OverlayKind): string {
  return OVERLAY_KINDS.find(item => item.kind === kind)?.icon ?? '?'
}

/** 同类图层的下一个默认序号，用于“文字 2”这类名称。 */
export function nextKindIndex(layers: OverlayLayer[], kind: OverlayKind): number {
  return layers.filter(layer => layer.kind === kind).length + 1
}

export function clampBox(box: OverlayBox, width: number, height: number): OverlayBox {
  const w = Math.max(MIN_OVERLAY_PIXELS, Math.min(width * 2, box.w))
  const h = Math.max(MIN_OVERLAY_PIXELS, Math.min(height * 2, box.h))
  // 框与画面至少保留 MIN_OVERLAY_PIXELS 的重叠，避免拖出画面后再也找不回来。
  const x = Math.max(MIN_OVERLAY_PIXELS - w, Math.min(width - MIN_OVERLAY_PIXELS, box.x))
  const y = Math.max(MIN_OVERLAY_PIXELS - h, Math.min(height - MIN_OVERLAY_PIXELS, box.y))
  return { x, y, w, h }
}

/** 原视频坐标与镜像后坐标互相换算；镜像是对合变换，同一个函数也用于反向换算。 */
export function toDisplayBox(box: OverlayBox, flip: FlipState, width: number, height: number): OverlayBox {
  return {
    x: flip.horizontal ? width - box.x - box.w : box.x,
    y: flip.vertical ? height - box.y - box.h : box.y,
    w: box.w,
    h: box.h,
  }
}

export type OverlayHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

/**
 * 按拖动位移计算新的框（与 initial 同一坐标系，单位为像素）：move 整体平移，四角以对角为锚点缩放。
 * lockAspect 时保持初始宽高比（图片图层）。
 */
export function dragOverlayBox(initial: OverlayBox, handle: OverlayHandle, dx: number, dy: number, lockAspect: boolean): OverlayBox {
  if (handle === 'move')
    return { ...initial, x: initial.x + dx, y: initial.y + dy }
  const signX = handle.includes('w') ? -1 : 1
  const signY = handle.includes('n') ? -1 : 1
  const anchorX = signX > 0 ? initial.x : initial.x + initial.w
  const anchorY = signY > 0 ? initial.y : initial.y + initial.h
  let w = Math.max(MIN_OVERLAY_PIXELS, initial.w + signX * dx)
  let h = Math.max(MIN_OVERLAY_PIXELS, initial.h + signY * dy)
  if (lockAspect && initial.h > 0) {
    const ratio = initial.w / initial.h
    w = Math.max(w, h * ratio)
    h = w / ratio
  }
  return { x: signX > 0 ? anchorX : anchorX - w, y: signY > 0 ? anchorY : anchorY - h, w, h }
}

export function makeOverlay(kind: OverlayKind, time: number, info: MediaInfo, index: number, imageAspect = 1): OverlayLayer {
  const { width: W, height: H, duration } = info
  let w: number
  let h: number
  if (kind === 'text') {
    w = W * 0.4
    h = H * 0.12
  }
  else if (kind === 'emoji') {
    w = Math.min(W, H) * 0.15
    h = w
  }
  else if (kind === 'image') {
    w = W * 0.25
    h = w / (imageAspect > 0 ? imageAspect : 1)
  }
  else {
    w = W * 0.3
    h = H * 0.2
  }
  const start = Math.max(0, Math.min(time, duration - MIN_OVERLAY_SECONDS))
  const box = clampBox({ x: (W - w) / 2, y: (H - h) / 2, w, h }, W, H)
  return {
    id: crypto.randomUUID(),
    name: `${kindLabel(kind)} ${index}`,
    kind,
    start,
    end: duration,
    easing: 'linear',
    opacity: 1,
    keyframes: [{ time: Math.max(start, time), ...box }],
    ...(kind === 'text' ? { text: '水印文字', color: '#ffffff', outline: true } : {}),
    ...(kind === 'emoji' ? { text: EMOJI_PRESETS[0], outline: false } : {}),
    ...(kind === 'solid' ? { color: '#000000' } : {}),
    ...(kind === 'mosaic' ? { mosaicSize: DEFAULT_MOSAIC_SIZE } : {}),
  }
}

export function isOverlayVisible(layer: OverlayLayer, time: number): boolean {
  return time >= layer.start - TIME_EPSILON && time <= layer.end + TIME_EPSILON
}

/** 不考虑显示时段，按关键帧求 time 时刻的框；首帧之前和末帧之后取端点值。 */
export function interpolateBox(layer: OverlayLayer, time: number): OverlayBox {
  const frames = layer.keyframes
  const first = frames[0]
  const last = frames[frames.length - 1]
  if (time <= first.time)
    return pickBox(first)
  if (time >= last.time)
    return pickBox(last)
  let index = 0
  while (index < frames.length - 2 && frames[index + 1].time <= time)
    index++
  const from = frames[index]
  const to = frames[index + 1]
  if (layer.easing === 'hold')
    return pickBox(from)
  const ratio = (time - from.time) / Math.max(TIME_EPSILON, to.time - from.time)
  const lerp = (a: number, b: number) => a + (b - a) * ratio
  return { x: lerp(from.x, to.x), y: lerp(from.y, to.y), w: lerp(from.w, to.w), h: lerp(from.h, to.h) }
}

/** time 不在图层显示时段内时返回 null。 */
export function resolveBox(layer: OverlayLayer, time: number): OverlayBox | null {
  return isOverlayVisible(layer, time) ? interpolateBox(layer, time) : null
}

export function visibleOverlays(layers: OverlayLayer[], time: number): Array<{ layer: OverlayLayer, box: OverlayBox }> {
  const result: Array<{ layer: OverlayLayer, box: OverlayBox }> = []
  for (const layer of layers) {
    const box = resolveBox(layer, time)
    if (box)
      result.push({ layer, box })
  }
  return result
}

function pickBox(frame: OverlayBox): OverlayBox {
  return { x: frame.x, y: frame.y, w: frame.w, h: frame.h }
}

/** 与已有关键帧相差不超过 snap 秒时直接改写它，否则插入新关键帧。 */
export function upsertKeyframe(layer: OverlayLayer, time: number, box: OverlayBox, snap: number): OverlayLayer {
  const existing = layer.keyframes.findIndex(frame => Math.abs(frame.time - time) <= snap)
  const keyframes = existing >= 0
    ? layer.keyframes.map((frame, index) => index === existing ? { time: frame.time, ...pickBox(box) } : frame)
    : [...layer.keyframes, { time, ...pickBox(box) }].sort((a, b) => a.time - b.time)
  return { ...layer, keyframes }
}

/** 删除 time 处的关键帧，至少保留 1 个。 */
export function removeKeyframe(layer: OverlayLayer, time: number): OverlayLayer {
  if (layer.keyframes.length <= 1)
    return layer
  const keyframes = layer.keyframes.filter(frame => Math.abs(frame.time - time) > TIME_EPSILON)
  return keyframes.length && keyframes.length < layer.keyframes.length ? { ...layer, keyframes } : layer
}

export function overlayTimeMarks(layer: OverlayLayer): OverlayTimeMarks {
  return { start: layer.start, end: layer.end, keyframes: layer.keyframes.map(frame => frame.time) }
}

export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface Surface {
  canvas: OffscreenCanvas | HTMLCanvasElement
  context: Context2D
}

/** 优先使用 OffscreenCanvas，不支持时回退到 DOM canvas。 */
export function createSurface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (context)
      return { canvas, context }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context)
    throw new Error('当前浏览器不支持 Canvas 2D 绘图。')
  return { canvas, context }
}

let mosaicSurface: Surface | null = null

function mosaicScratch(width: number, height: number): Surface {
  if (!mosaicSurface || mosaicSurface.canvas.width < width || mosaicSurface.canvas.height < height) {
    const current = mosaicSurface?.canvas
    mosaicSurface = createSurface(Math.max(width, current?.width ?? 0), Math.max(height, current?.height ?? 0))
  }
  return mosaicSurface
}

function outlineColor(color: string): string {
  const value = Number.parseInt(color.slice(1), 16)
  if (!Number.isFinite(value))
    return 'rgba(0, 0, 0, .75)'
  const luminance = 0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)
  return luminance > 140 ? 'rgba(0, 0, 0, .75)' : 'rgba(255, 255, 255, .85)'
}

export interface DrawOverlayOptions {
  flip: FlipState
  /** 原视频显示宽高。 */
  width: number
  height: number
  /** 目标画布左上角在镜像后坐标系中的位置（导出时为裁剪框左上角）。 */
  offsetX: number
  offsetY: number
  /** 原视频像素到目标画布像素的缩放。 */
  scale: number
  images: ReadonlyMap<string, ImageBitmap>
}

/**
 * 预览与导出共用的图层绘制。
 * frame 是与 ctx 画布同一像素坐标的当前画面（通常就是 ctx 的画布自身），马赛克从中取样。
 */
export function drawOverlays(ctx: Context2D, frame: CanvasImageSource, layers: OverlayLayer[], time: number, options: DrawOverlayOptions): void {
  const { flip, width, height, offsetX, offsetY, scale, images } = options
  const canvasWidth = ctx.canvas.width
  const canvasHeight = ctx.canvas.height
  for (const { layer, box } of visibleOverlays(layers, time)) {
    const display = toDisplayBox(box, flip, width, height)
    const dx = (display.x - offsetX) * scale
    const dy = (display.y - offsetY) * scale
    const dw = display.w * scale
    const dh = display.h * scale
    if (dw < 0.5 || dh < 0.5 || dx > canvasWidth || dy > canvasHeight || dx + dw < 0 || dy + dh < 0)
      continue
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity))
    if (layer.kind === 'solid') {
      ctx.fillStyle = layer.color ?? '#000000'
      ctx.fillRect(dx, dy, dw, dh)
    }
    else if (layer.kind === 'image') {
      const bitmap = layer.imageId ? images.get(layer.imageId) : undefined
      if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
        const ratio = Math.min(dw / bitmap.width, dh / bitmap.height)
        const iw = bitmap.width * ratio
        const ih = bitmap.height * ratio
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(bitmap, dx + (dw - iw) / 2, dy + (dh - ih) / 2, iw, ih)
      }
    }
    else if (layer.kind === 'mosaic') {
      drawMosaic(ctx, frame, dx, dy, dw, dh, Math.max(1, (layer.mosaicSize ?? DEFAULT_MOSAIC_SIZE) * scale))
    }
    else {
      drawText(ctx, layer, dx, dy, dw, dh)
    }
    ctx.restore()
  }
}

function drawMosaic(ctx: Context2D, frame: CanvasImageSource, dx: number, dy: number, dw: number, dh: number, block: number) {
  const left = Math.max(0, Math.floor(dx))
  const top = Math.max(0, Math.floor(dy))
  const right = Math.min(ctx.canvas.width, Math.ceil(dx + dw))
  const bottom = Math.min(ctx.canvas.height, Math.ceil(dy + dh))
  const regionWidth = right - left
  const regionHeight = bottom - top
  if (regionWidth < 1 || regionHeight < 1)
    return
  const cols = Math.max(1, Math.ceil(regionWidth / block))
  const rows = Math.max(1, Math.ceil(regionHeight / block))
  const scratch = mosaicScratch(cols, rows)
  scratch.context.imageSmoothingEnabled = true
  scratch.context.imageSmoothingQuality = 'medium'
  scratch.context.drawImage(frame, left, top, regionWidth, regionHeight, 0, 0, cols, rows)
  ctx.beginPath()
  ctx.rect(left, top, regionWidth, regionHeight)
  ctx.clip()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(scratch.canvas, 0, 0, cols, rows, left, top, cols * block, rows * block)
}

function drawText(ctx: Context2D, layer: OverlayLayer, dx: number, dy: number, dw: number, dh: number) {
  const content = layer.kind === 'emoji' ? (layer.text || EMOJI_PRESETS[0]) : (layer.text ?? '')
  if (!content.trim())
    return
  ctx.font = `700 100px ${FONT_FAMILY}`
  const measured = Math.max(1, ctx.measureText(content).width)
  // 按“完整放进框内”求字号：宽度受文字长度限制，高度留出行距。
  const padding = layer.outline ? 0.9 : 0.96
  const size = Math.max(1, Math.min((dw * padding * 100) / measured, (dh * padding) / 1.2))
  ctx.font = `700 ${size}px ${FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = dx + dw / 2
  const cy = dy + dh / 2
  const color = layer.color ?? '#ffffff'
  if (layer.outline) {
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(1, size * 0.12)
    ctx.strokeStyle = outlineColor(color)
    ctx.strokeText(content, cx, cy)
  }
  ctx.fillStyle = color
  ctx.fillText(content, cx, cy)
}

/** 解码图片，最长边限制在 MAX_IMAGE_SIDE 内，输出保留透明的 PNG 与可直接绘制的位图。 */
export async function prepareImage(file: Blob): Promise<OverlayImage> {
  let source: ImageBitmap
  try {
    source = await createImageBitmap(file)
  }
  catch {
    throw new Error('无法读取该图片，请选择 PNG、JPG、WebP 或 GIF 图片。')
  }
  const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * ratio))
  const height = Math.max(1, Math.round(source.height * ratio))
  const surface = createSurface(width, height)
  surface.context.drawImage(source, 0, 0, width, height)
  source.close()
  const canvas = surface.canvas
  const blob = 'convertToBlob' in canvas
    ? await canvas.convertToBlob({ type: 'image/png' })
    : await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('图片编码失败。')), 'image/png'))
  const bitmap = await createImageBitmap(canvas)
  return { blob, bitmap }
}
