import type { RangeImportMode } from '../aiRanges'
import type { MediaInfo } from '../media'
import type { SpeedRange, TrimRange } from '../timeMap'
import { useEffect, useState } from 'react'
import { buildRangePrompt, IMPORT_STEPS, PROMPT_STEPS } from '../aiRanges'
import { copyText } from '../clipboard'
import { formatTime, MAX_SPEED, MIN_SPEED } from '../timeMap'
import { HoverTip } from './HoverTip'
import { NumberInput } from './NumberInput'
import { RangeImportDialog } from './RangeImportDialog'

interface RangePanelProps {
  ranges: SpeedRange[]
  trim: TrimRange
  info: MediaInfo
  fileName: string
  selectedId: string | null
  invalid: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<SpeedRange>) => void
  onDelete: (id: string) => void
  onImport: (ranges: SpeedRange[], mode: RangeImportMode) => void
}

function StepsTip({ title, steps }: { title: string, steps: string[] }) {
  return (
    <>
      <strong>{title}</strong>
      <ol>{steps.map(step => <li key={step}>{step}</li>)}</ol>
    </>
  )
}

export function RangePanel({ ranges, trim, info, fileName, selectedId, invalid, onSelect, onUpdate, onDelete, onImport }: RangePanelProps) {
  const duration = info.duration
  const [importOpen, setImportOpen] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (copyState === 'idle')
      return
    const timer = window.setTimeout(setCopyState, 1800, 'idle')
    return () => window.clearTimeout(timer)
  }, [copyState])

  const copyPrompt = () => {
    void copyText(buildRangePrompt(info, fileName, trim)).then(ok => setCopyState(ok ? 'copied' : 'failed'))
  }

  return (
    <div className="side-section range-section">
      <div className="section-title-row compact">
        <div>
          <p className="section-kicker">SPEED RANGES</p>
          <h2>变速区间</h2>
        </div>
        <span className="count-badge">{ranges.length}</span>
      </div>
      <div className="range-ai-tools">
        <span>AI 标注</span>
        <div className="range-ai-group" role="group" aria-label="AI 标注变速区间">
          <HoverTip tip={<StepsTip title="第 1 步：把提示词和视频交给 AI" steps={PROMPT_STEPS} />}>
            <button type="button" className={copyState} onClick={copyPrompt}>
              {copyState === 'copied' ? '✓ 已复制' : copyState === 'failed' ? '复制失败' : '复制提示词'}
            </button>
          </HoverTip>
          <HoverTip tip={<StepsTip title="第 2 步：导入 AI 返回的 JSON" steps={IMPORT_STEPS} />}>
            <button type="button" onClick={() => setImportOpen(true)}>导入 JSON</button>
          </HoverTip>
        </div>
      </div>
      {ranges.length === 0
        ? (
            <div className="empty-ranges">
              <span>⌁</span>
              <p>还没有变速区间</p>
              <small>在时间轴拖动，或从当前播放头添加</small>
            </div>
          )
        : (
            <div className="range-list">
              {ranges.map((range, index) => (
                <div key={range.id} className={`range-item ${selectedId === range.id ? 'selected' : ''}`} onClick={() => onSelect(range.id)}>
                  <div className="range-item-head">
                    <i className={range.speed > 1 ? 'fast-dot' : 'slow-dot'} />
                    <input
                      aria-label={`重命名区间 ${index + 1}`}
                      className="range-name-input"
                      value={range.name ?? ''}
                      maxLength={40}
                      placeholder={`区间 ${index + 1}`}
                      title="点击重命名"
                      onClick={event => event.stopPropagation()}
                      onChange={event => onUpdate(range.id, { name: event.target.value })}
                    />
                    {(range.end <= trim.start || range.start >= trim.end) && <em className="outside-tag">已被裁掉</em>}
                    <button
                      aria-label="删除区间"
                      title="删除区间"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(range.id)
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="time-inputs">
                    <label>
                      开始（秒）
                      <em className="time-hint">{formatTime(range.start)}</em>
                      <NumberInput min={0} max={duration} step={0.01} value={range.start} onCommit={value => onUpdate(range.id, { start: value })} />
                    </label>
                    <span>→</span>
                    <label>
                      结束（秒）
                      <em className="time-hint">{formatTime(range.end)}</em>
                      <NumberInput min={0} max={duration} step={0.01} value={range.end} onCommit={value => onUpdate(range.id, { end: value })} />
                    </label>
                  </div>
                  <div className="speed-control">
                    <span>播放速度</span>
                    <div className="speed-control-row">
                      <div className="speed-input-group">
                        <NumberInput ariaLabel="播放速度" className="speed-number" min={MIN_SPEED} max={MAX_SPEED} step={0.01} value={range.speed} onCommit={value => onUpdate(range.id, { speed: value })} />
                        <span aria-hidden="true">倍速</span>
                      </div>
                      <input aria-label="播放速度滑块" type="range" min={MIN_SPEED} max="4" step="0.01" value={Math.min(4, range.speed)} onChange={event => onUpdate(range.id, { speed: Number(event.target.value) })} />
                    </div>
                  </div>
                  <div className="range-result">
                    {formatTime(range.end - range.start)}
                    {' '}
                    →
                    {' '}
                    {formatTime((range.end - range.start) / range.speed)}
                  </div>
                </div>
              ))}
            </div>
          )}
      {invalid && (
        <p className="validation-error">
          区间不能重叠，且速度须在
          {MIN_SPEED}
          ×–
          {MAX_SPEED}
          × 之间。
        </p>
      )}
      {importOpen && <RangeImportDialog duration={duration} trim={trim} existingCount={ranges.length} onImport={onImport} onClose={() => setImportOpen(false)} />}
    </div>
  )
}
