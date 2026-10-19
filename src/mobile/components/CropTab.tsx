import type { MediaInfo } from '../../media'
import type { CropRect, FlipAxis, FlipState, TrimRange } from '../../timeMap'
import { formatTime } from '../../timeMap'
import { NumberField } from './NumberField'

const ASPECT_PRESETS: { label: string, value: (width: number, height: number) => number | null }[] = [
  { label: '自由', value: () => null },
  { label: '原始', value: (width, height) => width / height },
  { label: '16:9', value: () => 16 / 9 },
  { label: '9:16', value: () => 9 / 16 },
  { label: '1:1', value: () => 1 },
  { label: '4:3', value: () => 4 / 3 },
  { label: '3:4', value: () => 3 / 4 },
]

interface CropTabProps {
  info: MediaInfo
  trim: TrimRange
  crop: CropRect | null
  cropAspect: number | null
  cropEditing: boolean
  flip: FlipState
  currentTime: number
  frameStep: number
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

export function CropTab(props: CropTabProps) {
  const { info, trim, crop, cropAspect, cropEditing, flip, currentTime, frameStep, exporting, isTrimmed, outputWidth, outputHeight } = props
  return (
    <section className="m-panel">
      <div className="m-card">
        <div className="m-card-head">
          <div>
            <p className="m-kicker">TRIM</p>
            <h3>时长裁剪</h3>
          </div>
          <button type="button" className="m-text-button" disabled={!isTrimmed} onClick={props.onTrimReset}>重置</button>
        </div>
        <div className="m-field">
          <span>
            开始（秒）
            <em className="m-field-hint">{formatTime(trim.start)}</em>
          </span>
          <div className="m-field-row">
            <NumberField ariaLabel="导出开始" min={0} max={info.duration} step={frameStep} value={trim.start} onCommit={value => props.onTrimChange({ start: value })} />
            <button type="button" className="m-chip" onClick={() => props.onTrimChange({ start: currentTime })}>设为播放头</button>
          </div>
        </div>
        <div className="m-field">
          <span>
            结束（秒）
            <em className="m-field-hint">{formatTime(trim.end)}</em>
          </span>
          <div className="m-field-row">
            <NumberField ariaLabel="导出结束" min={0} max={info.duration} step={frameStep} value={trim.end} onCommit={value => props.onTrimChange({ end: value })} />
            <button type="button" className="m-chip" onClick={() => props.onTrimChange({ end: currentTime })}>设为播放头</button>
          </div>
        </div>
        <p className="m-card-foot">
          保留
          {' '}
          {formatTime(trim.end - trim.start)}
          {' / 原始 '}
          {formatTime(info.duration)}
        </p>
      </div>

      <div className="m-card">
        <div className="m-card-head">
          <div>
            <p className="m-kicker">CROP</p>
            <h3>画面裁剪</h3>
          </div>
          <button type="button" className="m-text-button" disabled={!crop && !cropAspect} onClick={props.onCropReset}>重置</button>
        </div>
        <div className="m-chip-row scroll">
          {ASPECT_PRESETS.map((preset) => {
            const value = preset.value(info.width, info.height)
            const active = value === null ? cropAspect === null : cropAspect !== null && Math.abs(cropAspect - value) < 1e-3
            return <button key={preset.label} type="button" className={`m-chip ${active ? 'active' : ''}`} onClick={() => props.onAspectChange(value)}>{preset.label}</button>
          })}
        </div>
        <button type="button" className={`m-block-button ${cropEditing ? 'accent' : 'outline'}`} disabled={exporting} onClick={props.onToggleEditing}>
          {cropEditing ? '✓ 完成框选' : '⌗ 在画面上框选'}
        </button>
        <p className="m-card-foot">
          输出画面
          {' '}
          {outputWidth}
          ×
          {outputHeight}
          {crop && ` · 偏移 ${crop.left}, ${crop.top}`}
        </p>
      </div>

      <div className="m-card">
        <div className="m-card-head">
          <div>
            <p className="m-kicker">MIRROR</p>
            <h3>画面镜像</h3>
          </div>
        </div>
        <div className="m-toggle-row">
          <button type="button" className={`m-toggle ${flip.horizontal ? 'active' : ''}`} aria-pressed={flip.horizontal} disabled={exporting} onClick={() => props.onToggleFlip('horizontal')}>
            <span aria-hidden="true">⇋</span>
            水平镜像
            <small>左右翻转</small>
          </button>
          <button type="button" className={`m-toggle ${flip.vertical ? 'active' : ''}`} aria-pressed={flip.vertical} disabled={exporting} onClick={() => props.onToggleFlip('vertical')}>
            <span aria-hidden="true">⇅</span>
            垂直翻转
            <small>上下颠倒</small>
          </button>
        </div>
        <p className="m-card-foot">预览画面会同步镜像；已有的裁剪框会跟着画面一起翻转。</p>
      </div>
    </section>
  )
}
