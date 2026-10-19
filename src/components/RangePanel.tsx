import type { SpeedRange, TrimRange } from '../timeMap'
import { formatTime, MAX_SPEED, MIN_SPEED } from '../timeMap'
import { NumberInput } from './NumberInput'

interface RangePanelProps {
  ranges: SpeedRange[]
  trim: TrimRange
  duration: number
  selectedId: string | null
  invalid: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<SpeedRange>) => void
  onDelete: (id: string) => void
}

export function RangePanel({ ranges, trim, duration, selectedId, invalid, onSelect, onUpdate, onDelete }: RangePanelProps) {
  return (
    <div className="side-section range-section">
      <div className="section-title-row compact">
        <div>
          <p className="section-kicker">SPEED RANGES</p>
          <h2>变速区间</h2>
        </div>
        <span className="count-badge">{ranges.length}</span>
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
    </div>
  )
}
