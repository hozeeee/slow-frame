import type { AudioCodec, OutputFormat, VideoCodec, VideoSample } from 'mediabunny'
import type { CropRect, FlipState, SpeedRange, TrimRange } from './timeMap'
import {
  ALL_FORMATS,

  AudioSample,
  BlobSource,
  BufferTarget,
  Conversion,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Input,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,

  Quality,

  WebMOutputFormat,
} from 'mediabunny'
import { isFlipped, sourceToOutputTime, speedAt, trimmedRanges } from './timeMap'

export interface MediaInfo {
  duration: number
  width: number
  height: number
  fps: number
  videoCodec: string
  audioCodec: string | null
  hasAudio: boolean
}

export type ExportQuality = 'compact' | 'balanced' | 'high'
export type ExportFormat = 'mp4' | 'mov' | 'webm'

export const EXPORT_FORMATS: ReadonlyArray<{ value: ExportFormat, label: string, extension: string }> = [
  { value: 'mp4', label: 'MP4（通用）', extension: 'mp4' },
  { value: 'mov', label: 'MOV', extension: 'mov' },
  { value: 'webm', label: 'WebM', extension: 'webm' },
]

export function exportExtension(format: ExportFormat): string {
  return EXPORT_FORMATS.find(item => item.value === format)?.extension ?? 'mp4'
}

export interface ExportOptions {
  ranges: SpeedRange[]
  /** 保留的源视频时间段。 */
  trim: TrimRange
  /** 画面裁剪区域（镜像后的坐标系）；为空表示保留完整画面。 */
  crop: CropRect | null
  flip: FlipState
  quality: ExportQuality
  format: ExportFormat
  onProgress: (progress: number) => void
  signal?: AbortSignal
}

function createInput(file: File): Input<BlobSource> {
  return new Input({ formats: ALL_FORMATS, source: new BlobSource(file) })
}

export function browserCapabilityError(): string | null {
  if (!('VideoDecoder' in globalThis) || !('VideoEncoder' in globalThis)) {
    return '当前浏览器缺少 WebCodecs 视频编解码能力。请使用最新版 Chrome、Edge 或 Safari。'
  }
  return null
}

export async function inspectMedia(file: File): Promise<MediaInfo> {
  const input = createInput(file)
  try {
    if (!(await input.canRead()))
      throw new Error('无法识别该文件的容器格式。')
    const video = await input.getPrimaryVideoTrack()
    if (!video)
      throw new Error('文件中没有视频轨道。')
    if (!(await video.canDecode()))
      throw new Error('浏览器不支持解码该视频的编码格式。')
    const audio = await input.getPrimaryAudioTrack()
    if (audio && !(await audio.canDecode()))
      throw new Error('浏览器不支持解码该视频的音频格式。')
    const duration = await input.computeDuration(audio ? [video, audio] : [video])
    const stats = await video.computePacketStats(120)
    return {
      duration,
      width: await video.getDisplayWidth(),
      height: await video.getDisplayHeight(),
      fps: stats.averagePacketRate,
      videoCodec: (await video.getCodec()) ?? '未知',
      audioCodec: audio ? ((await audio.getCodec()) ?? '未知') : null,
      hasAudio: Boolean(audio),
    }
  }
  finally {
    input.dispose()
  }
}

function qualityValue(quality: ExportQuality): Quality {
  return new Quality(quality === 'compact' ? 0.45 : quality === 'high' ? 0.92 : 0.65)
}

function outputSpec(format: ExportFormat): { container: OutputFormat, videoCodec: VideoCodec, audioCodec: AudioCodec } {
  if (format === 'mov')
    return { container: new MovOutputFormat({ fastStart: false }), videoCodec: 'avc', audioCodec: 'aac' }
  if (format === 'webm')
    return { container: new WebMOutputFormat(), videoCodec: 'vp9', audioCodec: 'opus' }
  return { container: new Mp4OutputFormat({ fastStart: false }), videoCodec: 'avc', audioCodec: 'aac' }
}

function retimeVideo(sample: VideoSample, ranges: SpeedRange[]): VideoSample {
  const start = sample.timestamp
  const end = start + sample.duration
  const mappedStart = sourceToOutputTime(start, ranges)
  const mappedEnd = sourceToOutputTime(end, ranges)
  const result = sample.clone()
  result.setTimestamp(mappedStart)
  result.setDuration(Math.max(1e-6, mappedEnd - mappedStart))
  return result
}

function audioBoundaries(start: number, end: number, ranges: SpeedRange[]): number[] {
  const points = [start, end]
  for (const range of ranges) {
    if (range.start > start && range.start < end)
      points.push(range.start)
    if (range.end > start && range.end < end)
      points.push(range.end)
  }
  return [...new Set(points)].sort((a, b) => a - b)
}

/**
 * 以线性插值改变采样数，音频时长与视频同步变化。
 * 这会产生经典的“磁带变速”音效：慢放时音调降低，加速时音调升高。
 */
function retimeAudio(sample: AudioSample, ranges: SpeedRange[]): AudioSample[] {
  const sampleStart = sample.timestamp
  const sampleEnd = sampleStart + sample.duration
  const boundaries = audioBoundaries(sampleStart, sampleEnd, ranges)
  const channels: Float32Array[] = []

  for (let channel = 0; channel < sample.numberOfChannels; channel++) {
    const plane = new Float32Array(sample.numberOfFrames)
    sample.copyTo(plane, { format: 'f32-planar', planeIndex: channel })
    channels.push(plane)
  }

  const output: AudioSample[] = []
  for (let part = 0; part < boundaries.length - 1; part++) {
    const start = boundaries[part]
    const end = boundaries[part + 1]
    const inputStartFrame = Math.max(0, Math.round((start - sampleStart) * sample.sampleRate))
    const inputEndFrame = Math.min(sample.numberOfFrames, Math.round((end - sampleStart) * sample.sampleRate))
    const inputFrames = inputEndFrame - inputStartFrame
    if (inputFrames <= 0)
      continue

    const speed = speedAt((start + end) / 2, ranges)
    const outputFrames = Math.max(1, Math.round(inputFrames / speed))
    const mappedStart = sourceToOutputTime(start, ranges)
    // 0.01× 会把音频扩展为 100 倍。按小块送入编码器，避免一次分配巨型 AudioSample。
    const maxChunkFrames = 16_384

    for (let outputOffset = 0; outputOffset < outputFrames; outputOffset += maxChunkFrames) {
      const chunkFrames = Math.min(maxChunkFrames, outputFrames - outputOffset)
      const data = new Float32Array(chunkFrames * sample.numberOfChannels)

      for (let channel = 0; channel < sample.numberOfChannels; channel++) {
        const source = channels[channel]
        const channelOffset = channel * chunkFrames
        for (let frame = 0; frame < chunkFrames; frame++) {
          const outputFrame = outputOffset + frame
          const position = inputStartFrame + Math.min(
            inputFrames - 1,
            ((outputFrame + 0.5) * inputFrames) / outputFrames - 0.5,
          )
          const left = Math.max(inputStartFrame, Math.floor(position))
          const right = Math.min(inputEndFrame - 1, left + 1)
          const fraction = Math.max(0, position - left)
          data[channelOffset + frame] = source[left] * (1 - fraction) + source[right] * fraction
        }
      }

      output.push(new AudioSample({
        data,
        format: 'f32-planar',
        numberOfChannels: sample.numberOfChannels,
        sampleRate: sample.sampleRate,
        timestamp: mappedStart + outputOffset / sample.sampleRate,
      }))
    }
  }
  return output
}

export async function exportVideo(file: File, options: ExportOptions): Promise<Blob> {
  const input = createInput(file)
  const target = new BufferTarget()
  const spec = outputSpec(options.format)
  const output = new Output({ format: spec.container, target })

  let conversion: Conversion | null = null
  const cancel = () => {
    void conversion?.cancel()
  }
  options.signal?.addEventListener('abort', cancel, { once: true })

  try {
    if (options.signal?.aborted)
      throw new DOMException('导出已取消', 'AbortError')
    const inputVideo = await input.getPrimaryVideoTrack()
    const inputAudio = await input.getPrimaryAudioTrack()
    const encodableVideo = await getFirstEncodableVideoCodec([spec.videoCodec], {
      width: options.crop?.width ?? await inputVideo?.getDisplayWidth(),
      height: options.crop?.height ?? await inputVideo?.getDisplayHeight(),
      quality: qualityValue(options.quality),
    })
    if (!encodableVideo)
      throw new Error(`当前浏览器不支持 ${options.format.toUpperCase()} 所需的视频编码器。`)
    if (inputAudio && !(await getFirstEncodableAudioCodec([spec.audioCodec]))) {
      throw new Error(`当前浏览器不支持 ${options.format.toUpperCase()} 所需的音频编码器。`)
    }
    // mediabunny 交给 process 的时间戳以裁剪起点为 0，区间也平移到同一坐标系。
    const ranges = trimmedRanges(options.ranges, options.trim)
    conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      copy: false,
      showWarnings: false,
      trim: { start: options.trim.start, end: options.trim.end },
      video: {
        codec: spec.videoCodec,
        quality: qualityValue(options.quality),
        forceTranscode: true,
        keyFrameInterval: 2,
        // mediabunny 只提供水平翻转：垂直翻转 = 旋转 180° 再水平翻转。
        // 翻转在裁剪之前执行，所以裁剪框使用镜像后的坐标。镜像时直接写入画面，不依赖播放器识别变换元数据。
        rotate: options.flip.vertical ? 180 : 0,
        flip: options.flip.horizontal !== options.flip.vertical,
        allowTransformationMetadata: !isFlipped(options.flip),
        crop: options.crop ?? undefined,
        process: sample => retimeVideo(sample, ranges),
      },
      audio: {
        codec: spec.audioCodec,
        quality: new Quality(options.quality === 'compact' ? 0.5 : options.quality === 'high' ? 0.9 : 0.72),
        forceTranscode: true,
        process: sample => retimeAudio(sample, ranges),
      },
    })

    if (!conversion.isValid || conversion.discardedTracks.length > 0) {
      const reasons = conversion.discardedTracks.map(track => track.reason).join('、')
      throw new Error(`无法完整建立音视频导出管线${reasons ? `：${reasons}` : ''}`)
    }
    conversion.onProgress = progress => options.onProgress(Math.max(0, Math.min(1, progress)))
    await conversion.execute()
    if (!target.buffer)
      throw new Error('导出完成但没有生成文件。')
    options.onProgress(1)
    return new Blob([target.buffer], { type: spec.container.mimeType })
  }
  finally {
    options.signal?.removeEventListener('abort', cancel)
    input.dispose()
  }
}
