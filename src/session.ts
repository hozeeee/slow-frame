import type { ExportFormat, ExportQuality, MediaInfo } from './media'
import type { CropRect, FlipState, SpeedRange, TrimRange } from './timeMap'
import {
  clampCrop,
  clampRange,
  clampTrim,

  isFlipped,
  isFullFrame,
  NO_FLIP,
  sortRanges,

} from './timeMap'

/** 一次编辑的全部可恢复状态。 */
export interface EditState {
  ranges: SpeedRange[]
  trim: TrimRange
  crop: CropRect | null
  cropAspect: number | null
  /** 画面镜像；旧版本的记录没有该字段，按未镜像处理。 */
  flip: FlipState
  quality: ExportQuality
  format: ExportFormat
}

export interface SessionFile {
  name: string
  size: number
  lastModified: number
  duration: number
  width: number
  height: number
}

export interface SessionRecord {
  key: string
  version: 1
  file: SessionFile
  edit: EditState
  updatedAt: number
  /** 最近一次导出编辑记录时的快照，用于判断是否有未导出的修改。 */
  exportedSnapshot: string | null
}

export interface SessionExport {
  app: 'slow-frame'
  version: 1
  file: SessionFile
  edit: EditState
  exportedAt: number
}

const DB_NAME = 'slow-frame'
const STORE = 'sessions'
const QUALITIES: ExportQuality[] = ['compact', 'balanced', 'high']
const FORMATS: ExportFormat[] = ['mp4', 'mov', 'webm']

export function fileKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`
}

export function describeFile(file: File, info: MediaInfo): SessionFile {
  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    duration: info.duration,
    width: info.width,
    height: info.height,
  }
}

export function defaultEdit(info: MediaInfo): EditState {
  return { ranges: [], trim: { start: 0, end: info.duration }, crop: null, cropAspect: null, flip: NO_FLIP, quality: 'high', format: 'mp4' }
}

const round = (value: number) => Math.round(value * 10_000) / 10_000

/** 与区间 id 无关的稳定快照，用于比较编辑内容是否变化。 */
export function snapshotOf(edit: EditState): string {
  return JSON.stringify({
    ranges: sortRanges(edit.ranges).map(range => [range.name ?? '', round(range.start), round(range.end), round(range.speed)]),
    trim: [round(edit.trim.start), round(edit.trim.end)],
    crop: edit.crop && [edit.crop.left, edit.crop.top, edit.crop.width, edit.crop.height],
    cropAspect: edit.cropAspect && round(edit.cropAspect),
    // 未镜像时不写入该字段，保证旧版本缓存里的快照仍然可以直接比较；旧记录的 edit 也可能没有 flip。
    ...(isFlipped(edit.flip ?? NO_FLIP) ? { flip: [edit.flip.horizontal, edit.flip.vertical] } : {}),
    quality: edit.quality,
    format: edit.format,
  })
}

/** 把来源不可信的编辑数据（缓存或导入文件）校正到当前视频的合法范围内。 */
export function normalizeEdit(raw: unknown, info: MediaInfo): EditState {
  const data = (raw ?? {}) as Partial<Record<keyof EditState, unknown>>
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

  const ranges = Array.isArray(data.ranges)
    ? data.ranges
        .filter((item): item is SpeedRange => Boolean(item) && finite(item.start) && finite(item.end) && finite(item.speed))
        .filter(item => item.start < info.duration)
        .map(item => clampRange({
          id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
          name: typeof item.name === 'string' ? item.name.trim().slice(0, 40) || undefined : undefined,
          start: item.start,
          end: item.end,
          speed: item.speed,
        }, info.duration))
    : []

  const rawTrim = (data.trim ?? {}) as Partial<TrimRange>
  const trim = clampTrim({
    start: finite(rawTrim.start) ? rawTrim.start : 0,
    end: finite(rawTrim.end) ? rawTrim.end : info.duration,
  }, info.duration)

  const rawCrop = data.crop as Partial<CropRect> | null | undefined
  let crop: CropRect | null = null
  if (rawCrop && finite(rawCrop.left) && finite(rawCrop.top) && finite(rawCrop.width) && finite(rawCrop.height)) {
    crop = clampCrop(rawCrop as CropRect, info.width, info.height)
    if (isFullFrame(crop, info.width, info.height))
      crop = null
  }

  const cropAspect = finite(data.cropAspect) && data.cropAspect > 0 ? data.cropAspect : null
  const rawFlip = (data.flip ?? {}) as Partial<Record<keyof FlipState, unknown>>
  const flip: FlipState = { horizontal: rawFlip.horizontal === true, vertical: rawFlip.vertical === true }
  const quality = QUALITIES.includes(data.quality as ExportQuality) ? data.quality as ExportQuality : 'high'
  const format = FORMATS.includes(data.format as ExportFormat) ? data.format as ExportFormat : 'mp4'
  return { ranges, trim, crop, cropAspect, flip, quality, format }
}

export function buildExport(file: SessionFile, edit: EditState): SessionExport {
  return { app: 'slow-frame', version: 1, file, edit, exportedAt: Date.now() }
}

export function parseExport(text: string): SessionExport {
  let data: unknown
  try {
    data = JSON.parse(text)
  }
  catch {
    throw new Error('编辑记录不是有效的 JSON 文件。')
  }
  const record = data as Partial<SessionExport>
  if (!record || record.app !== 'slow-frame' || !record.edit)
    throw new Error('这不是 Slow Frame 导出的编辑记录。')
  if (record.version !== 1)
    throw new Error('暂不支持该版本的编辑记录。')
  return record as SessionExport
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) {
        reject(new Error('当前浏览器不支持 IndexedDB。'))
        return
      }
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE, { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    dbPromise.catch(() => {
      dbPromise = null
    })
  }
  return dbPromise
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const request = action(transaction.objectStore(STORE))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export function loadSession(key: string): Promise<SessionRecord | undefined> {
  return run('readonly', store => store.get(key) as IDBRequest<SessionRecord | undefined>)
}

export function saveSession(record: SessionRecord): Promise<IDBValidKey> {
  return run('readwrite', store => store.put(record))
}
