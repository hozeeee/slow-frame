export interface SpeedRange {
  id: string
  /** 用户自定义名称；为空时界面回退为“区间 N”。 */
  name?: string
  start: number
  end: number
  /** 播放速度：0.5 表示半速（时长 2 倍），2 表示 2 倍速。 */
  speed: number
}

/** 导出保留的源视频时间段。 */
export interface TrimRange {
  start: number
  end: number
}

/** 画面裁剪区域，单位为视频显示像素。 */
export interface CropRect {
  left: number
  top: number
  width: number
  height: number
}

/** 画面镜像：horizontal 为左右镜像，vertical 为上下翻转。 */
export interface FlipState {
  horizontal: boolean
  vertical: boolean
}

export type FlipAxis = keyof FlipState

export const NO_FLIP: FlipState = { horizontal: false, vertical: false }

export interface Bounds {
  min: number
  max: number
}

export const MIN_SPEED = 0.01
export const MAX_SPEED = 16
export const MIN_RANGE_SECONDS = 0.01
export const MIN_TRIM_SECONDS = 0.1
export const MIN_CROP_PIXELS = 16

export function sortRanges(ranges: SpeedRange[]): SpeedRange[] {
  return [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)
}

export function isRangeValid(range: SpeedRange, duration: number): boolean {
  return Number.isFinite(range.start)
    && Number.isFinite(range.end)
    && Number.isFinite(range.speed)
    && range.start >= 0
    && range.end <= duration + 1e-6
    && range.end - range.start >= MIN_RANGE_SECONDS
    && range.speed >= MIN_SPEED
    && range.speed <= MAX_SPEED
}

export function rangesOverlap(ranges: SpeedRange[]): boolean {
  const sorted = sortRanges(ranges)
  return sorted.some((range, index) => index > 0 && range.start < sorted[index - 1].end - 1e-6)
}

export function speedAt(time: number, ranges: SpeedRange[]): number {
  return ranges.find(range => time >= range.start && time < range.end)?.speed ?? 1
}

/** 将原视频时间映射为导出视频时间。 */
export function sourceToOutputTime(sourceTime: number, ranges: SpeedRange[]): number {
  const sorted = sortRanges(ranges)
  let sourceCursor = 0
  let outputCursor = 0

  for (const range of sorted) {
    if (sourceTime <= range.start)
      return outputCursor + (sourceTime - sourceCursor)
    outputCursor += range.start - sourceCursor
    if (sourceTime <= range.end)
      return outputCursor + (sourceTime - range.start) / range.speed
    outputCursor += (range.end - range.start) / range.speed
    sourceCursor = range.end
  }
  return outputCursor + (sourceTime - sourceCursor)
}

/** 将导出视频时间反查为原视频时间。 */
export function outputToSourceTime(outputTime: number, ranges: SpeedRange[], duration: number): number {
  const sorted = sortRanges(ranges)
  let sourceCursor = 0
  let outputCursor = 0

  for (const range of sorted) {
    const normalDuration = range.start - sourceCursor
    if (outputTime <= outputCursor + normalDuration)
      return sourceCursor + (outputTime - outputCursor)
    outputCursor += normalDuration

    const mappedDuration = (range.end - range.start) / range.speed
    if (outputTime <= outputCursor + mappedDuration) {
      return range.start + (outputTime - outputCursor) * range.speed
    }
    outputCursor += mappedDuration
    sourceCursor = range.end
  }
  return Math.min(duration, sourceCursor + (outputTime - outputCursor))
}

export function outputDuration(duration: number, ranges: SpeedRange[]): number {
  return sourceToOutputTime(duration, ranges)
}

export function clampRange(range: SpeedRange, duration: number): SpeedRange {
  const start = Math.max(0, Math.min(duration - MIN_RANGE_SECONDS, range.start))
  const end = Math.max(start + MIN_RANGE_SECONDS, Math.min(duration, range.end))
  return { ...range, start, end, speed: Math.max(MIN_SPEED, Math.min(MAX_SPEED, range.speed)) }
}

/** 某区间在不与其它区间重叠的前提下可占据的时间范围（以其中点判断左右邻居）。 */
export function freeSpanFor(range: SpeedRange, ranges: SpeedRange[], duration: number): Bounds {
  const center = (range.start + range.end) / 2
  let min = 0
  let max = duration
  for (const other of ranges) {
    if (other.id === range.id)
      continue
    if ((other.start + other.end) / 2 <= center)
      min = Math.max(min, other.end)
    else max = Math.min(max, other.start)
  }
  return { min, max: Math.max(min, max) }
}

/** 返回 time 所在的空白间隙；time 落在已有区间内时返回 null。 */
export function gapAt(time: number, ranges: SpeedRange[], duration: number): Bounds | null {
  let min = 0
  let max = duration
  for (const range of ranges) {
    if (time >= range.start && time < range.end)
      return null
    if (range.end <= time)
      min = Math.max(min, range.end)
    else max = Math.min(max, range.start)
  }
  return { min, max }
}

export function clampTrim(trim: TrimRange, duration: number): TrimRange {
  const minLength = Math.min(MIN_TRIM_SECONDS, duration)
  const start = Math.max(0, Math.min(duration - minLength, Number.isFinite(trim.start) ? trim.start : 0))
  const end = Math.max(start + minLength, Math.min(duration, Number.isFinite(trim.end) ? trim.end : duration))
  return { start, end }
}

/** 将区间裁剪到保留时间段内，并平移到以保留段开头为 0 的时间坐标。 */
export function trimmedRanges(ranges: SpeedRange[], trim: TrimRange): SpeedRange[] {
  return sortRanges(ranges)
    .map(range => ({
      ...range,
      start: Math.max(range.start, trim.start) - trim.start,
      end: Math.min(range.end, trim.end) - trim.start,
    }))
    .filter(range => range.end - range.start > 1e-6)
}

/** 裁剪区域取偶数像素，避免 H.264 4:2:0 编码对奇数宽高报错。 */
export function clampCrop(crop: CropRect, videoWidth: number, videoHeight: number): CropRect {
  const even = (value: number) => Math.floor(value / 2) * 2
  const minWidth = Math.min(MIN_CROP_PIXELS, even(videoWidth))
  const minHeight = Math.min(MIN_CROP_PIXELS, even(videoHeight))
  const width = Math.max(minWidth, Math.min(even(videoWidth), even(crop.width)))
  const height = Math.max(minHeight, Math.min(even(videoHeight), even(crop.height)))
  const left = Math.max(0, Math.min(even(videoWidth - width), even(crop.left)))
  const top = Math.max(0, Math.min(even(videoHeight - height), even(crop.top)))
  return { left, top, width, height }
}

export function isFullFrame(crop: CropRect, videoWidth: number, videoHeight: number): boolean {
  return crop.left <= 0 && crop.top <= 0 && crop.width >= videoWidth - 1 && crop.height >= videoHeight - 1
}

/** 在画面中居中放置指定宽高比的最大裁剪框。 */
export function centeredCrop(aspect: number, videoWidth: number, videoHeight: number): CropRect {
  const width = videoWidth / videoHeight > aspect ? videoHeight * aspect : videoWidth
  const height = width / aspect
  return clampCrop({ left: (videoWidth - width) / 2, top: (videoHeight - height) / 2, width, height }, videoWidth, videoHeight)
}

export function isFlipped(flip: FlipState): boolean {
  return flip.horizontal || flip.vertical
}

/** 裁剪框以镜像后的画面为坐标系，翻转时同步翻转裁剪框，使框住的内容保持不变。 */
export function flipCrop(crop: CropRect, axis: FlipAxis, videoWidth: number, videoHeight: number): CropRect {
  const next = axis === 'horizontal'
    ? { ...crop, left: videoWidth - crop.left - crop.width }
    : { ...crop, top: videoHeight - crop.top - crop.height }
  return clampCrop(next, videoWidth, videoHeight)
}

/** 预览画面使用的 CSS transform，与导出结果的镜像方向一致。 */
export function flipTransform(flip: FlipState): string | undefined {
  return isFlipped(flip) ? `scale(${flip.horizontal ? -1 : 1}, ${flip.vertical ? -1 : 1})` : undefined
}

export function makeRange(start: number, end: number, speed = 0.5): SpeedRange {
  return { id: crypto.randomUUID(), start, end, speed }
}

export function formatTime(seconds: number, precise = true): string {
  if (!Number.isFinite(seconds))
    return '00:00.000'
  const safe = Math.max(0, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = Math.floor(safe % 60)
  const ms = Math.floor((safe - Math.floor(safe)) * 1000)
  const hh = hours > 0 ? `${hours.toString().padStart(2, '0')}:` : ''
  return `${hh}${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}${precise ? `.${ms.toString().padStart(3, '0')}` : ''}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`
}
