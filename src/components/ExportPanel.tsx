import type { ExportFormat, ExportQuality, MediaInfo } from '../media'
import { EXPORT_FORMATS } from '../media'
import { formatBytes } from '../timeMap'

interface ExportPanelProps {
  info: MediaInfo
  quality: ExportQuality
  format: ExportFormat
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
}

export function ExportPanel(props: ExportPanelProps) {
  const sizeRatio = props.outputSize === null || props.originalSize === 0 ? null : props.outputSize / props.originalSize
  return (
    <div className="export-section">
      <p className="section-kicker">EXPORT</p>
      <h2>导出视频</h2>
      <label className="quality-select">
        文件类型
        <select value={props.format} onChange={event => props.onFormatChange(event.target.value as ExportFormat)} disabled={props.exporting}>
          {EXPORT_FORMATS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="quality-select">
        画质
        <select value={props.quality} onChange={event => props.onQualityChange(event.target.value as ExportQuality)} disabled={props.exporting}>
          <option value="compact">精简</option>
          <option value="balanced">均衡</option>
          <option value="high">最高</option>
        </select>
      </label>
      <div className="size-comparison">
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
      <div className="export-note">
        <span>♫</span>
        <p>
          <strong>{props.info.hasAudio ? '音频同步变速' : '原视频无音频'}</strong>
          <small>{props.info.hasAudio ? '慢放降调，加速升调，始终保持音画同步' : '将导出纯视频文件'}</small>
        </p>
      </div>
      {Boolean(props.missingImageCount) && (
        <p className="validation-error">
          有
          {' '}
          {props.missingImageCount}
          {' '}
          个图片图层缺少图片，这些图层不会被导出。
        </p>
      )}
      {props.exporting && (
        <div className="progress-wrap">
          <div>
            <span>正在编码…</span>
            <b>
              {Math.round(props.progress * 100)}
              %
            </b>
          </div>
          <div className="progress-track"><i style={{ width: `${props.progress * 100}%` }} /></div>
        </div>
      )}
      {props.resultUrl
        ? (
            <a className="download-button" href={props.resultUrl} download={props.outputName}>↓ 下载导出视频</a>
          )
        : (
            <button className="export-button" disabled={props.disabled || props.exporting} onClick={props.onExport}>{props.exporting ? '正在处理视频' : '开始导出'}</button>
          )}
      {props.exporting && <button className="cancel-button" onClick={props.onCancel}>取消导出</button>}
      <small className="memory-note">MP4 兼容性最佳；WebM 通常体积更小。导出期间请保持页面打开。</small>
    </div>
  )
}
