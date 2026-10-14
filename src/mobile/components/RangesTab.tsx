import type { SpeedRange, TrimRange } from '../../timeMap'
import { useEffect, useRef } from 'react'
import { formatTime, MAX_SPEED, MIN_SPEED } from '../../timeMap'
import { NumberField } from './NumberField'

const SPEED_PRESETS = [0.1, 0.25, 0.5, 0.75, 1.5, 2, 4]

interface RangesTabProps {
  ranges: SpeedRange[]
  trim: TrimRange
  duration: number
  frameStep: number
  currentTime: number
  selectedId: string | null
  invalid: boolean
  onAdd: () => void
  onSelect: (id: string | null) => void
  onSeek: (time: number) => void
  onUpdate: (id: string, patch: Partial<SpeedRange>) => void
  onDelete: (id: string) => void
}

/** 变速区间列表：收起时为一行摘要，点按展开为完整的编辑卡片。 */
export function RangesTab({ ranges, trim, duration, frameStep, currentTime, selectedId, invalid, onAdd, onSelect, onSeek, onUpdate, onDelete }: RangesTabProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // 在时间轴上选中区间时，把对应卡片滚动到可见位置。
  useEffect(() => {
    if (selectedId)
      listRef.current?.querySelector(`[data-range="${selectedId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  return (
    <section className="m-panel">
      <div className="m-panel-head">
        <div>
          <p className="m-kicker">SPEED RANGES</p>
          <h2>
            变速区间
            <small>{ranges.length}</small>
          </h2>
        </div>
        <button type="button" className="m-pill-button" onClick={onAdd}>＋ 在播放头添加</button>
      </div>

      {ranges.length === 0
        ? (
            <div className="m-empty">
              <span>⌁</span>
              <p>还没有变速区间</p>
              <small>长按时间轴空白处并拖动框选，或点击上方按钮从播放头添加</small>
            </div>
          )
        : (
            <div className="m-range-list" ref={listRef}>
              {ranges.map((range, index) => {
                const open = range.id === selectedId
                const outside = range.end <= trim.start || range.start >= trim.end
                const label = range.name || `区间 ${index + 1}`
                return (
                  <article key={range.id} data-range={range.id} className={`m-range ${open ? 'open' : ''} ${range.speed > 1 ? 'fast' : ''}`}>
                    <button type="button" className="m-range-summary" aria-expanded={open} onClick={() => onSelect(open ? null : range.id)}>
                      <i />
                      <span className="m-range-title">
                        <b>{label}</b>
                        <small>
                          {formatTime(range.start)}
                          {' – '}
                          {formatTime(range.end)}
                        </small>
                      </span>
                      {outside && <em>已被裁掉</em>}
                      <strong>
                        {range.speed}
                        ×
                      </strong>
                      <span className="m-chevron" aria-hidden="true">›</span>
                    </button>

                    {open && (
                      <div className="m-range-body">
                        <label className="m-field">
                          <span>名称</span>
                          <input
                            className="m-text-input"
                            value={range.name ?? ''}
                            maxLength={40}
                            placeholder={`区间 ${index + 1}`}
                            enterKeyHint="done"
                            onChange={event => onUpdate(range.id, { name: event.target.value })}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter')
                                event.currentTarget.blur()
                            }}
                          />
                        </label>

                        <div className="m-field">
                          <span>开始（秒）</span>
                          <div className="m-field-row">
                            <NumberField ariaLabel="区间开始" min={0} max={duration} step={frameStep} value={range.start} onCommit={value => onUpdate(range.id, { start: value })} />
                            <button type="button" className="m-chip" onClick={() => onUpdate(range.id, { start: currentTime })}>设为播放头</button>
                          </div>
                        </div>
                        <div className="m-field">
                          <span>结束（秒）</span>
                          <div className="m-field-row">
                            <NumberField ariaLabel="区间结束" min={0} max={duration} step={frameStep} value={range.end} onCommit={value => onUpdate(range.id, { end: value })} />
                            <button type="button" className="m-chip" onClick={() => onUpdate(range.id, { end: currentTime })}>设为播放头</button>
                          </div>
                        </div>

                        <div className="m-field">
                          <span>播放速度</span>
                          <div className="m-chip-row">
                            {SPEED_PRESETS.map(speed => (
                              <button key={speed} type="button" className={`m-chip ${Math.abs(range.speed - speed) < 1e-6 ? 'active' : ''}`} onClick={() => onUpdate(range.id, { speed })}>
                                {speed}
                                ×
                              </button>
                            ))}
                          </div>
                          <div className="m-speed-row">
                            <input
                              aria-label="播放速度滑块"
                              className="m-slider"
                              type="range"
                              min={MIN_SPEED}
                              max="4"
                              step="0.01"
                              value={Math.min(4, range.speed)}
                              onChange={event => onUpdate(range.id, { speed: Number(event.target.value) })}
                            />
                            <NumberField ariaLabel="播放速度" unit="×" digits={2} min={MIN_SPEED} max={MAX_SPEED} step={range.speed < 1 ? 0.05 : 0.25} value={range.speed} onCommit={value => onUpdate(range.id, { speed: value })} />
                          </div>
                        </div>

                        <div className="m-range-foot">
                          <span>
                            {formatTime(range.end - range.start)}
                            {' → '}
                            {formatTime((range.end - range.start) / range.speed)}
                          </span>
                          <button type="button" className="m-text-button" onClick={() => onSeek(range.start)}>跳到开头</button>
                          <button type="button" className="m-text-button danger" onClick={() => onDelete(range.id)}>删除区间</button>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

      {invalid && (
        <p className="m-validation">
          区间不能重叠，且速度须在
          {' '}
          {MIN_SPEED}
          ×–
          {MAX_SPEED}
          × 之间。
        </p>
      )}
    </section>
  )
}
