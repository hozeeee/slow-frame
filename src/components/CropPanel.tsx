import type { MediaInfo } from '../media'
import type { CropRect, FlipAxis, FlipState, TrimRange } from '../timeMap'
import { formatTime, isFlipped } from '../timeMap'
import { NumberInput } from './NumberInput'

const ASPECT_PRESETS: { label: string, value: (width: number, height: number) => number | null }[] = [
  { label: '自由', value: () => null },
  { label: '原始', value: (width, height) => width / height },
  { label: '16:9', value: () => 16 / 9 },
  { label: '9:16', value: () => 9 / 16 },
  { label: '1:1', value: () => 1 },
  { label: '4:3', value: () => 4 / 3 },
  { label: '3:4', value: () => 3 / 4 },
]

interface CropPanelProps {
  info: MediaInfo
  trim: TrimRange
  crop: CropRect | null
  cropAspect: number | null
  cropEditing: boolean
  flip: FlipState
  currentTime: number
  exporting: boolean
  isTrimmed: boolean
  outputWidth: number
  outputHeight: number
  onTrimChange: (patch: Partial<TrimRange>) => void
  onTrimReset: () => void
  onAspectChange: (aspect: number | null) => void
  onCropReset: () => void
  onToggleEditing: () => void
  onToggleFlip: (axis: FlipAxis) => void
}

export function CropPanel(props: CropPanelProps) {
  const { info, trim, crop, cropAspect, cropEditing, flip, currentTime, exporting, isTrimmed, outputWidth, outputHeight } = props
  return (
    <div className="crop-card">
      <div className="section-title-row">
        <div>
          <p className="section-kicker">TRIM, CROP &amp; MIRROR</p>
          <h2>裁剪与镜像</h2>
        </div>
      </div>
      <div className="crop-panel-grid">
        <div className="crop-group">
          <div className="crop-group-head">
            <strong>时长裁剪</strong>
            <button className="text-button" disabled={!isTrimmed} onClick={props.onTrimReset}>重置</button>
          </div>
          <div className="time-inputs">
            <label>
              开始（秒）
              <NumberInput min={0} max={info.duration} step={0.01} value={trim.start} onCommit={value => props.onTrimChange({ start: value })} />
            </label>
            <span>→</span>
            <label>
              结束（秒）
              <NumberInput min={0} max={info.duration} step={0.01} value={trim.end} onCommit={value => props.onTrimChange({ end: value })} />
            </label>
          </div>
          <div className="mini-actions">
            <button onClick={() => props.onTrimChange({ start: currentTime })}>播放头设为开始</button>
            <button onClick={() => props.onTrimChange({ end: currentTime })}>播放头设为结束</button>
          </div>
          <div className="range-result">
            保留
            {formatTime(trim.end - trim.start)}
            {' '}
            / 原始
            {formatTime(info.duration)}
          </div>
        </div>
        <div className="crop-group">
          <div className="crop-group-head">
            <strong>画面裁剪</strong>
            <button className="text-button" disabled={!crop && !cropAspect} onClick={props.onCropReset}>重置</button>
          </div>
          <div className="aspect-row">
            {ASPECT_PRESETS.map((preset) => {
              const value = preset.value(info.width, info.height)
              const active = value === null ? cropAspect === null : cropAspect !== null && Math.abs(cropAspect - value) < 1e-3
              return <button key={preset.label} className={active ? 'active' : ''} onClick={() => props.onAspectChange(value)}>{preset.label}</button>
            })}
          </div>
          <button className={`secondary-button crop-toggle ${cropEditing ? 'active' : ''}`} disabled={exporting} onClick={props.onToggleEditing}>
            {cropEditing ? '✓ 完成框选' : '⌗ 在画面上框选'}
          </button>
          <div className="flip-row">
            <span>镜像</span>
            <button className={flip.horizontal ? 'active' : ''} aria-pressed={flip.horizontal} disabled={exporting} onClick={() => props.onToggleFlip('horizontal')}>⇋ 水平镜像</button>
            <button className={flip.vertical ? 'active' : ''} aria-pressed={flip.vertical} disabled={exporting} onClick={() => props.onToggleFlip('vertical')}>⇅ 垂直翻转</button>
          </div>
          <div className="range-result">
            输出画面
            {outputWidth}
            ×
            {outputHeight}
            {crop && ` · 偏移 ${crop.left}, ${crop.top}`}
            {isFlipped(flip) && ' · 已镜像'}
          </div>
        </div>
      </div>
    </div>
  )
}
