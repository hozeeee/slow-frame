import type { ExportFormat, ExportQuality, MediaInfo } from './media'
import type { EditState, SessionRecord } from './session'
import type { CropRect, SpeedRange, TrimRange } from './timeMap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { browserCapabilityError, exportExtension, exportVideo, inspectMedia } from './media'
import {
  buildExport,
  defaultEdit,
  describeFile,
  fileKey,
  loadSession,
  normalizeEdit,
  parseExport,
  saveSession,
  snapshotOf,
} from './session'
import {
  centeredCrop,
  clampRange,
  clampTrim,
  formatTime,
  freeSpanFor,
  gapAt,
  isFullFrame,
  isRangeValid,
  makeRange,
  MIN_RANGE_SECONDS,
  MIN_TRIM_SECONDS,
  outputDuration,
  rangesOverlap,
  sortRanges,
  speedAt,
  trimmedRanges,
} from './timeMap'

/**
 * 编辑器的全部状态与业务逻辑（文件导入、编辑记录缓存、预览播放、导出），
 * 与界面无关，桌面端与移动端共用。
 */
export function useEditor() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const exportAbortRef = useRef<AbortController | null>(null)
  const loadTokenRef = useRef(0)
  const [file, setFile] = useState<File | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [ranges, setRanges] = useState<SpeedRange[]>([])
  const [trim, setTrim] = useState<TrimRange>({ start: 0, end: 0 })
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [cropAspect, setCropAspect] = useState<number | null>(null)
  const [cropEditing, setCropEditing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const previewTimeRef = useRef(0)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(browserCapabilityError)
  const [notice, setNotice] = useState<string | null>(null)
  const [quality, setQuality] = useState<ExportQuality>('high')
  const [format, setFormat] = useState<ExportFormat>('mp4')
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultSize, setResultSize] = useState<number | null>(null)
  const [resultSnapshot, setResultSnapshot] = useState('')

  const [sessionReady, setSessionReady] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<SessionRecord | null>(null)
  const [baseline, setBaseline] = useState('')
  const savedOnceRef = useRef(false)
  const pendingSaveRef = useRef<SessionRecord | null>(null)
  const saveTimerRef = useRef(0)

  const orderedRanges = useMemo(() => sortRanges(ranges), [ranges])
  const invalidRanges = info ? ranges.some(range => !isRangeValid(range, info.duration)) || rangesOverlap(ranges) : false
  const finalDuration = info ? outputDuration(trim.end - trim.start, trimmedRanges(orderedRanges, trim)) : 0
  const activeSpeed = speedAt(currentTime, ranges)
  const isTrimmed = info ? trim.start > 1e-3 || trim.end < info.duration - 1e-3 : false

  const edit = useMemo<EditState>(() => ({ ranges, trim, crop, cropAspect, quality, format }), [ranges, trim, crop, cropAspect, quality, format])
  const snapshot = useMemo(() => snapshotOf(edit), [edit])
  const emptySnapshot = useMemo(() => info ? snapshotOf(defaultEdit(info)) : '', [info])
  const dirty = Boolean(file && info && sessionReady && snapshot !== baseline)
  const visibleResultUrl = resultSnapshot === snapshot ? resultUrl : null
  const visibleResultSize = resultSnapshot === snapshot ? resultSize : null

  const restoreSummary = useMemo(() => {
    if (!pendingRestore || !info)
      return ''
    const restored = normalizeEdit(pendingRestore.edit, info)
    const parts = [`${restored.ranges.length} 个变速区间`]
    if (restored.trim.start > 1e-3 || restored.trim.end < info.duration - 1e-3)
      parts.push(`时长裁剪 ${formatTime(restored.trim.start)} – ${formatTime(restored.trim.end)}`)
    if (restored.crop)
      parts.push(`画面裁剪 ${restored.crop.width}×${restored.crop.height}`)
    return parts.join(' · ')
  }, [pendingRestore, info])

  const restoreHint = !pendingRestore
    ? ''
    : pendingRestore.exportedSnapshot === null
      ? '该记录尚未导出过。'
      : pendingRestore.exportedSnapshot === snapshotOf(pendingRestore.edit)
        ? '该记录已导出过，缓存与导出文件一致。'
        : '缓存中包含导出之后的新修改。'

  const flushSave = useCallback(() => {
    window.clearTimeout(saveTimerRef.current)
    const record = pendingSaveRef.current
    pendingSaveRef.current = null
    if (record)
      void saveSession(record).catch(() => undefined)
  }, [])

  useEffect(() => () => {
    if (mediaUrl)
      URL.revokeObjectURL(mediaUrl)
    if (resultUrl)
      URL.revokeObjectURL(resultUrl)
  }, [mediaUrl, resultUrl])

  useEffect(() => {
    if (!notice)
      return
    const timer = window.setTimeout(setNotice, 3200, null)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!file || !info || !sessionReady)
      return
    if (snapshot === emptySnapshot && !savedOnceRef.current)
      return
    savedOnceRef.current = true
    pendingSaveRef.current = {
      key: fileKey(file),
      version: 1,
      file: describeFile(file, info),
      edit,
      updatedAt: Date.now(),
      exportedSnapshot: baseline === emptySnapshot ? null : baseline,
    }
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(flushSave, 400)
  }, [file, info, sessionReady, snapshot, emptySnapshot, baseline, edit, flushSave])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden')
        flushSave()
    }
    window.addEventListener('pagehide', flushSave)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flushSave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flushSave])

  useEffect(() => {
    if (!dirty && !exporting)
      return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      flushSave()
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, exporting, flushSave])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !info)
      return
    video.muted = muted
    if (!isPreviewPlaying) {
      video.pause()
      return
    }

    const nativeMinimum = 0.1
    const frameDuration = 1 / Math.max(1, info.fps)
    const stopTime = trim.end
    let animationFrame = 0
    let lastWallTime = performance.now()
    let manualMode = speedAt(previewTimeRef.current, ranges) < nativeMinimum

    const startNativePlayback = () => {
      const speed = speedAt(previewTimeRef.current, ranges)
      video.currentTime = previewTimeRef.current
      video.playbackRate = Math.max(nativeMinimum, speed)
      void video.play().catch(() => setIsPreviewPlaying(false))
    }

    if (manualMode)
      video.pause()
    else startNativePlayback()

    const tick = (wallTime: number) => {
      const elapsed = Math.min(0.25, Math.max(0, (wallTime - lastWallTime) / 1000))
      lastWallTime = wallTime
      if (manualMode) {
        const speed = speedAt(previewTimeRef.current, ranges)
        if (speed >= nativeMinimum) {
          manualMode = false
          startNativePlayback()
        }
        else {
          previewTimeRef.current = Math.min(stopTime, previewTimeRef.current + elapsed * speed)
          setCurrentTime(previewTimeRef.current)
          const displayTime = Math.min(stopTime, Math.floor(previewTimeRef.current / frameDuration) * frameDuration)
          if (!video.seeking && Math.abs(video.currentTime - displayTime) >= frameDuration * 0.75)
            video.currentTime = displayTime
        }
      }
      else {
        const previousTime = previewTimeRef.current
        const nativeTime = video.currentTime
        const crossedUltraSlowRange = ranges
          .filter(range => range.speed < nativeMinimum && range.start > previousTime && range.start <= nativeTime)
          .sort((a, b) => a.start - b.start)[0]
        previewTimeRef.current = Math.min(stopTime, crossedUltraSlowRange?.start ?? nativeTime)
        setCurrentTime(previewTimeRef.current)
        const speed = speedAt(previewTimeRef.current, ranges)
        if (speed < nativeMinimum) {
          video.pause()
          if (crossedUltraSlowRange)
            video.currentTime = crossedUltraSlowRange.start
          manualMode = true
        }
        else if (Math.abs(video.playbackRate - speed) > 0.001) {
          video.playbackRate = speed
        }
      }
      if (previewTimeRef.current >= stopTime - 1e-4 || video.ended) {
        video.pause()
        setIsPreviewPlaying(false)
        return
      }
      animationFrame = requestAnimationFrame(tick)
    }

    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [ranges, mediaUrl, info, isPreviewPlaying, muted, trim.end])

  const applyEdit = (next: EditState) => {
    setRanges(next.ranges)
    setTrim(next.trim)
    setCrop(next.crop)
    setCropAspect(next.cropAspect)
    setQuality(next.quality)
    setFormat(next.format)
    setSelectedId(null)
    setCropEditing(false)
  }

  const chooseFile = async (nextFile: File) => {
    flushSave()
    const token = ++loadTokenRef.current
    savedOnceRef.current = false
    setSessionReady(false)
    setPendingRestore(null)
    setLoading(true)
    setError(null)
    setInfo(null)
    setRanges([])
    setTrim({ start: 0, end: 0 })
    setCrop(null)
    setCropAspect(null)
    setCropEditing(false)
    setQuality('high')
    setFormat('mp4')
    setSelectedId(null)
    setCurrentTime(0)
    previewTimeRef.current = 0
    setIsPreviewPlaying(false)
    setResultSize(null)
    setResultSnapshot('')
    setResultUrl((old) => {
      if (old)
        URL.revokeObjectURL(old)
      return null
    })
    setMediaUrl((old) => {
      if (old)
        URL.revokeObjectURL(old)
      return URL.createObjectURL(nextFile)
    })
    setFile(nextFile)
    try {
      const nextInfo = await inspectMedia(nextFile)
      if (token !== loadTokenRef.current)
        return
      const initial = defaultEdit(nextInfo)
      setInfo(nextInfo)
      setTrim(initial.trim)
      setBaseline(snapshotOf(initial))
      const record = await loadSession(fileKey(nextFile)).catch(() => undefined)
      if (token !== loadTokenRef.current)
        return
      if (record && snapshotOf(normalizeEdit(record.edit, nextInfo)) !== snapshotOf(initial))
        setPendingRestore(record)
      else setSessionReady(true)
    }
    catch (reason) {
      if (token === loadTokenRef.current)
        setError(reason instanceof Error ? reason.message : '读取视频失败。')
    }
    finally {
      if (token === loadTokenRef.current)
        setLoading(false)
    }
  }

  const restoreSession = () => {
    if (!pendingRestore || !info)
      return
    applyEdit(normalizeEdit(pendingRestore.edit, info))
    setBaseline(pendingRestore.exportedSnapshot ?? emptySnapshot)
    savedOnceRef.current = true
    setPendingRestore(null)
    setSessionReady(true)
    setNotice('已导入上次的编辑')
  }

  const discardRestore = () => {
    setPendingRestore(null)
    setSessionReady(true)
  }

  const leaveWorkspace = () => {
    if ((dirty || exporting) && !window.confirm(exporting
      ? '视频正在导出，离开会取消导出。确定要更换视频吗？'
      : '编辑记录尚未导出（已自动缓存在本浏览器，下次打开同一视频可恢复）。确定要更换视频吗？')) {
      return
    }
    exportAbortRef.current?.abort()
    flushSave()
    loadTokenRef.current++
    setSessionReady(false)
    setPendingRestore(null)
    setIsPreviewPlaying(false)
    setFile(null)
  }

  const exportSession = () => {
    if (!file || !info)
      return
    const payload = buildExport(describeFile(file, info), edit)
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${file.name.replace(/\.[^.]+$/, '')}.slowframe.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setBaseline(snapshot)
    setNotice('编辑记录已导出')
  }

  const importSession = async (picked: File) => {
    if (!file || !info)
      return
    try {
      const data = parseExport(await picked.text())
      const source = data.file
      if (source && (source.name !== file.name || source.size !== file.size)
        && !window.confirm(`该记录来自「${source.name}」，与当前视频不一致。仍要导入吗？`)) {
        return
      }
      if (dirty && !window.confirm('导入会覆盖当前未导出的编辑，确定继续吗？'))
        return
      const next = normalizeEdit(data.edit, info)
      applyEdit(next)
      setBaseline(snapshotOf(next))
      savedOnceRef.current = true
      setError(null)
      setNotice(`已导入编辑记录：${next.ranges.length} 个变速区间`)
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : '导入编辑记录失败。')
    }
  }

  const addRange = () => {
    if (!info)
      return
    const gap = gapAt(currentTime, ranges, info.duration)
    if (!gap || gap.max - gap.min < MIN_RANGE_SECONDS) {
      setNotice('播放头位于已有区间内，请移到空白处再添加')
      return
    }
    let start = Math.max(gap.min, Math.min(currentTime, gap.max - MIN_RANGE_SECONDS))
    const end = Math.min(gap.max, start + Math.min(2, info.duration))
    if (end - start < 0.1)
      start = Math.max(gap.min, end - 2)
    const range = makeRange(start, end, 0.5)
    setRanges(current => [...current, range])
    setSelectedId(range.id)
  }

  const updateRange = (id: string, patch: Partial<SpeedRange>) => {
    if (!info)
      return
    setRanges(current => current.map((range) => {
      if (range.id !== id)
        return range
      const bounds = freeSpanFor(range, current, info.duration)
      const next = { ...range, ...patch }
      if (patch.start !== undefined)
        next.start = Math.max(bounds.min, Math.min(next.start, next.end - MIN_RANGE_SECONDS))
      if (patch.end !== undefined)
        next.end = Math.min(bounds.max, Math.max(next.end, next.start + MIN_RANGE_SECONDS))
      return clampRange(next, info.duration)
    }))
  }

  const deleteRange = (id: string) => setRanges(current => current.filter(item => item.id !== id))

  const updateTrim = (patch: Partial<TrimRange>) => {
    if (!info)
      return
    setTrim((current) => {
      const next = { ...current, ...patch }
      if (patch.start !== undefined)
        next.start = Math.min(next.start, current.end - MIN_TRIM_SECONDS)
      if (patch.end !== undefined)
        next.end = Math.max(next.end, current.start + MIN_TRIM_SECONDS)
      return clampTrim(next, info.duration)
    })
  }

  const resetTrim = () => {
    if (info)
      setTrim({ start: 0, end: info.duration })
  }

  const updateCrop = (next: CropRect) => {
    if (!info)
      return
    setCrop(isFullFrame(next, info.width, info.height) ? null : next)
  }

  const chooseAspect = (aspect: number | null) => {
    if (!info)
      return
    setCropAspect(aspect)
    if (aspect)
      updateCrop(centeredCrop(aspect, info.width, info.height))
    setCropEditing(true)
  }

  const resetCrop = () => {
    setCrop(null)
    setCropAspect(null)
  }

  const seek = (time: number) => {
    previewTimeRef.current = time
    if (videoRef.current)
      videoRef.current.currentTime = time
    setCurrentTime(time)
  }

  const togglePreview = () => {
    if (!info)
      return
    if (isPreviewPlaying) {
      setIsPreviewPlaying(false)
      return
    }
    if (previewTimeRef.current < trim.start - 1e-3 || previewTimeRef.current >= trim.end - 0.01)
      seek(trim.start)
    setIsPreviewPlaying(true)
  }

  const beginExport = async () => {
    if (!file || !info || invalidRanges || exporting)
      return
    const controller = new AbortController()
    const exportingSnapshot = snapshot
    exportAbortRef.current = controller
    setCropEditing(false)
    setExporting(true)
    setProgress(0)
    setError(null)
    setResultSize(null)
    setResultSnapshot('')
    setResultUrl((old) => {
      if (old)
        URL.revokeObjectURL(old)
      return null
    })
    try {
      const blob = await exportVideo(file, {
        ranges: orderedRanges,
        trim,
        crop,
        quality,
        format,
        signal: controller.signal,
        onProgress: setProgress,
      })
      setResultSize(blob.size)
      setResultSnapshot(exportingSnapshot)
      setResultUrl(URL.createObjectURL(blob))
    }
    catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : '导出失败。')
    }
    finally {
      setExporting(false)
      exportAbortRef.current = null
    }
  }

  const cancelExport = () => exportAbortRef.current?.abort()

  const outputName = file ? `${file.name.replace(/\.[^.]+$/, '')}-retimed.${exportExtension(format)}` : `retimed.${exportExtension(format)}`
  const outputWidth = crop?.width ?? info?.width ?? 0
  const outputHeight = crop?.height ?? info?.height ?? 0
  const saveStatus = !sessionReady ? '' : dirty ? '已自动缓存 · 编辑记录未导出' : snapshot === emptySnapshot ? '编辑将自动缓存到本地' : '编辑记录已导出'

  return {
    videoRef,
    file,
    mediaUrl,
    info,
    ranges,
    orderedRanges,
    trim,
    crop,
    cropAspect,
    cropEditing,
    selectedId,
    currentTime,
    isPreviewPlaying,
    muted,
    loading,
    error,
    notice,
    quality,
    format,
    exporting,
    progress,
    resultUrl: visibleResultUrl,
    resultSize: visibleResultSize,
    sessionReady,
    pendingRestore,
    restoreSummary,
    restoreHint,
    dirty,
    saveStatus,
    invalidRanges,
    finalDuration,
    activeSpeed,
    isTrimmed,
    outputName,
    outputWidth,
    outputHeight,
    setRanges,
    setSelectedId,
    setCropEditing,
    setMuted,
    setQuality,
    setFormat,
    setNotice,
    chooseFile,
    restoreSession,
    discardRestore,
    leaveWorkspace,
    exportSession,
    importSession,
    addRange,
    updateRange,
    deleteRange,
    updateTrim,
    resetTrim,
    updateCrop,
    chooseAspect,
    resetCrop,
    seek,
    togglePreview,
    beginExport,
    cancelExport,
  }
}

export type Editor = ReturnType<typeof useEditor>
