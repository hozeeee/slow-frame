import type { ExportFormat, ExportQuality, MediaInfo } from '../../media'
import { useEffect, useState } from 'react'
import { EXPORT_FORMATS } from '../../media'
import { formatBytes, formatTime } from '../../timeMap'

const QUALITIES: { value: ExportQuality, label: string }[] = [
  { value: 'compact', label: '精简' },
  { value: 'balanced', label: '均衡' },
  { value: 'high', label: '最高' },
]

interface ExportTabProps {
  info: MediaInfo
  quality: ExportQuality
  format: ExportFormat
  finalDuration: number
  originalSize: number
  outputSize: number | null
  outputName: string
  resultUrl: string | null
  exporting: boolean
  progress: number
  disabled: boolean
  /** 图片缺失的图片图层数，这些图层不会被导出。 */
  missingImageCount?: number
  onQualityChange: (quality: ExportQuality) => void
  onFormatChange: (format: ExportFormat) => void
  onExport: () => void
  onCancel: () => void
  onNotice: (message: string) => void
}

const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'

export function ExportTab(props: ExportTabProps) {
  const { resultUrl, outputName } = props
  const [shareable, setShareable] = useState<{ url: string, file: File } | null>(null)
  const sizeRatio = props.outputSize === null || props.originalSize === 0 ? null : props.outputSize / props.originalSize
  const shareFile = shareable && shareable.url === resultUrl ? shareable.file : null

  // 系统分享需要在点按时同步调用，所以导出完成后就预先把结果包装成 File。
  useEffect(() => {
    if (!canShareFiles || !resultUrl)
      return
    const controller = new AbortController()
    void fetch(resultUrl, { signal: controller.signal })
      .then(response => response.blob())
      .then((blob) => {
        const file = new File([blob], outputName, { type: blob.type })
        if (!controller.signal.aborted && navigator.canShare({ files: [file] }))
          setShareable({ url: resultUrl, file })
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [resultUrl, outputName])

  const share = () => {
    if (!shareFile)
      return
    navigator.share({ files: [shareFile], title: outputName }).catch((reason: unknown) => {
      if (!(reason instanceof DOMException && reason.name === 'AbortError'))
        props.onNotice('分享失败，请改用下载')
    })
  }

  return (
    <section className="m-panel">
      <div className="m-card">
        <div className="m-card-head">
          <div>
            <p className="m-kicker">EXPORT</p>
            <h3>导出视频</h3>
          </div>
          <span className="m-card-meta">
            预计
            {' '}
            {formatTime(props.finalDuration)}
          </span>
        </div>
        <div className="m-field">
          <span>文件类型</span>
          <div className="m-segmented" role="radiogroup" aria-label="文件类型">
            {EXPORT_FORMATS.map(item => (
              <button key={item.value} type="button" role="radio" aria-checked={props.format === item.value} className={props.format === item.value ? 'active' : ''} disabled={props.exporting} onClick={() => props.onFormatChange(item.value)}>
                {item.extension.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="m-field">
          <span>画质</span>
          <div className="m-segmented" role="radiogroup" aria-label="画质">
            {QUALITIES.map(item => (
              <button key={item.value} type="button" role="radio" aria-checked={props.quality === item.value} className={props.quality === item.value ? 'active' : ''} disabled={props.exporting} onClick={() => props.onQualityChange(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="m-size">
          <div>
            <span>原始大小</span>
            <strong>{formatBytes(props.originalSize)}</strong>
          </div>
          <i>→</i>
          <div>
            <span>导出大小</span>
            <strong>{props.outputSize === null ? (props.exporting ? '计算中' : '导出后显示') : formatBytes(props.outputSize)}</strong>
          </div>
          {sizeRatio !== null && (
            <small>
              {sizeRatio <= 1 ? '减少' : '增加'}
              {' '}
              {Math.abs(1 - sizeRatio) * 100 < 0.1 ? '<0.1' : (Math.abs(1 - sizeRatio) * 100).toFixed(1)}
              %
            </small>
          )}
        </div>

        <div className="m-note">
          <span>♫</span>
          <p>
            <strong>{props.info.hasAudio ? '音频同步变速' : '原视频无音频'}</strong>
            <small>{props.info.hasAudio ? '慢放降调，加速升调，始终保持音画同步' : '将导出纯视频文件'}</small>
          </p>
        </div>

        {Boolean(props.missingImageCount) && (
          <p className="m-validation">
            有
            {' '}
            {props.missingImageCount}
            {' '}
            个图片图层缺少图片，这些图层不会被导出。
          </p>
        )}

        {props.exporting && (
          <div className="m-progress">
            <div>
              <span>正在编码…</span>
              <b>
                {Math.round(props.progress * 100)}
                %
              </b>
            </div>
            <div className="m-progress-track"><i style={{ width: `${props.progress * 100}%` }} /></div>
          </div>
        )}

        {resultUrl
          ? (
              <div className="m-result-actions">
                <a className="m-block-button primary" href={resultUrl} download={outputName}>↓ 下载导出视频</a>
                {shareFile && <button type="button" className="m-block-button outline" onClick={share}>分享 / 存储到相册</button>}
              </div>
            )
          : (
              <button type="button" className="m-block-button primary" disabled={props.disabled || props.exporting} onClick={props.onExport}>
                {props.exporting ? '正在处理视频' : '开始导出'}
              </button>
            )}
        {props.exporting && <button type="button" className="m-block-button ghost" onClick={props.onCancel}>取消导出</button>}
        <p className="m-card-foot center">MP4 兼容性最佳；WebM 通常体积更小。导出期间请保持本页在前台、不要锁屏。</p>
      </div>
    </section>
  )
}
