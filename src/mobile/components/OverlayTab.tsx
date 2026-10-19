import type { MediaInfo } from '../../media'
import type { OverlayKind, OverlayLayer, OverlayPatch } from '../../overlay'
import { useEffect, useRef, useState } from 'react'
import {
  EMOJI_PRESETS,
  kindIcon,
  MAX_MOSAIC_SIZE,
  MAX_OVERLAY_TEXT,
  MAX_OVERLAYS,
  MIN_MOSAIC_SIZE,
  OVERLAY_KINDS,
  overlayName,
} from '../../overlay'
import { formatTime } from '../../timeMap'
import { NumberField } from './NumberField'
import { Sheet } from './Sheet'

interface OverlayTabProps {
  info: MediaInfo
  overlays: OverlayLayer[]
  selected: OverlayLayer | null
  currentTime: number
  frameStep: number
  snap: number
  exporting: boolean
  isImageMissing: (layer: OverlayLayer) => boolean
  /** 图片类型由外部打开文件选择后再添加。 */
  onAdd: (kind: OverlayKind) => void
  onSelect: (id: string | null) => void
  onUpdate: (id: string, patch: OverlayPatch) => void
  onSpanChange: (id: string, patch: { start?: number, end?: number }) => void
  onDelete: (id: string) => void
  onMove: (id: string, delta: 1 | -1) => void
  onAddKeyframe: (id: string) => void
  onDeleteKeyframe: (id: string, time: number) => void
  onJumpKeyframe: (id: string, direction: 'prev' | 'next') => void
  onSeek: (time: number) => void
  onRequestImage: (id: string) => void
}

/** 水印 / 打码图层列表：展开的卡片里放关键帧操作，内容与显示时段等详细设置放进底部弹层。 */
export function OverlayTab(props: OverlayTabProps) {
  const { overlays, selected, currentTime, snap, exporting } = props
  const listRef = useRef<HTMLDivElement>(null)
  // 详细设置弹层绑定到打开它的图层，切换或取消选中后不会意外重新弹出。
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const full = overlays.length >= MAX_OVERLAYS
  // 列表按叠放顺序从上到下显示：越靠上的图层画在越上面。
  const stacked = overlays.map((layer, index) => ({ layer, index })).reverse()
  const selectedId = selected?.id ?? null

  useEffect(() => {
    if (selectedId)
      listRef.current?.querySelector(`[data-overlay="${selectedId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  return (
    <section className="m-panel">
      <div className="m-panel-head">
        <div>
          <p className="m-kicker">WATERMARK &amp; MOSAIC</p>
          <h2>
            水印 / 打码
            <small>{overlays.length}</small>
          </h2>
        </div>
      </div>
      <div className="m-chip-row scroll">
        {OVERLAY_KINDS.map(item => (
          <button key={item.kind} type="button" className="m-chip m-overlay-add" disabled={full || exporting} onClick={() => props.onAdd(item.kind)}>
            <b>{item.icon}</b>
            {item.label}
          </button>
        ))}
      </div>
      {full && (
        <p className="m-card-foot">
          最多添加
          {' '}
          {MAX_OVERLAYS}
          {' '}
          个图层
        </p>
      )}

      {overlays.length === 0
        ? (
            <div className="m-empty">
              <span>◩</span>
              <p>还没有图层</p>
              <small>添加文字、Emoji、图片、马赛克或色块，遮挡画面中的特定区域</small>
            </div>
          )
        : (
            <div className="m-range-list" ref={listRef}>
              {stacked.map(({ layer, index }) => {
                const open = layer.id === selectedId
                const missing = props.isImageMissing(layer)
                const onKeyframe = layer.keyframes.find(frame => Math.abs(frame.time - currentTime) <= snap)
                const hasPrev = layer.keyframes.some(frame => frame.time < currentTime - snap)
                const hasNext = layer.keyframes.some(frame => frame.time > currentTime + snap)
                return (
                  <article key={layer.id} data-overlay={layer.id} className={`m-range m-overlay-item ${open ? 'open' : ''}`}>
                    <button type="button" className="m-range-summary" aria-expanded={open} onClick={() => props.onSelect(open ? null : layer.id)}>
                      <i className="m-overlay-icon">{layer.kind === 'emoji' ? layer.text || kindIcon(layer.kind) : kindIcon(layer.kind)}</i>
                      <span className="m-range-title">
                        <b>{overlayName(layer)}</b>
                        <small>
                          {formatTime(layer.start)}
                          {' – '}
                          {formatTime(layer.end)}
                          {' · '}
                          {layer.keyframes.length}
                          {' '}
                          个关键帧
                        </small>
                      </span>
                      {missing && <em>图片缺失</em>}
                      <span className="m-chevron" aria-hidden="true">›</span>
                    </button>

                    {open && (
                      <div className="m-range-body">
                        <div className="m-field">
                          <span>关键帧</span>
                          <div className="m-overlay-key-nav">
                            <button type="button" className="m-chip" disabled={!hasPrev} onClick={() => props.onJumpKeyframe(layer.id, 'prev')}>‹ 上一个</button>
                            {onKeyframe
                              ? <button type="button" className="m-chip danger" disabled={layer.keyframes.length <= 1} onClick={() => props.onDeleteKeyframe(layer.id, onKeyframe.time)}>删除此帧</button>
                              : <button type="button" className="m-chip active" onClick={() => props.onAddKeyframe(layer.id)}>◆ 打关键帧</button>}
                            <button type="button" className="m-chip" disabled={!hasNext} onClick={() => props.onJumpKeyframe(layer.id, 'next')}>下一个 ›</button>
                          </div>
                          <div className="m-chip-row scroll">
                            {layer.keyframes.map(frame => (
                              <button key={frame.time} type="button" className={`m-chip ${Math.abs(frame.time - currentTime) <= snap ? 'active' : ''}`} onClick={() => props.onSeek(frame.time)}>
                                ◆
                                {' '}
                                {formatTime(frame.time)}
                              </button>
                            ))}
                          </div>
                        </div>
                        {missing && (
                          <div className="m-validation m-overlay-missing-note">
                            图片缺失（编辑记录不包含图片），该图层不会被导出。
                            <button type="button" className="m-text-button" onClick={() => props.onRequestImage(layer.id)}>选择图片</button>
                          </div>
                        )}
                        <p className="m-card-foot">暂停后拖动画面上的框，会自动在当前时间打关键帧。</p>
                        <div className="m-range-foot">
                          <span>
                            <button type="button" className="m-text-button" aria-label="上移一层" disabled={index === overlays.length - 1} onClick={() => props.onMove(layer.id, 1)}>↑</button>
                            <button type="button" className="m-text-button" aria-label="下移一层" disabled={index === 0} onClick={() => props.onMove(layer.id, -1)}>↓</button>
                          </span>
                          <button type="button" className="m-text-button" onClick={() => setSettingsId(layer.id)}>详细设置</button>
                          <button type="button" className="m-text-button danger" onClick={() => props.onDelete(layer.id)}>删除图层</button>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

      {selected && settingsId === selected.id && (
        <Sheet kicker="LAYER" title={overlayName(selected)} onClose={() => setSettingsId(null)}>
          <OverlaySettings {...props} layer={selected} />
          <button type="button" className="m-block-button primary" onClick={() => setSettingsId(null)}>完成</button>
        </Sheet>
      )}
    </section>
  )
}

function OverlaySettings(props: OverlayTabProps & { layer: OverlayLayer }) {
  const { layer, info, currentTime, frameStep } = props
  const update = (patch: OverlayPatch) => props.onUpdate(layer.id, patch)
  const blurOnEnter = (event: { key: string, currentTarget: HTMLInputElement }) => {
    if (event.key === 'Enter')
      event.currentTarget.blur()
  }

  return (
    <div className="m-overlay-settings">
      <label className="m-field">
        <span>名称</span>
        <input className="m-text-input" value={layer.name ?? ''} maxLength={40} placeholder={overlayName(layer)} enterKeyHint="done" onChange={event => update({ name: event.target.value })} onKeyDown={blurOnEnter} />
      </label>

      {layer.kind === 'text' && (
        <label className="m-field">
          <span>文字内容</span>
          <input className="m-text-input" value={layer.text ?? ''} maxLength={MAX_OVERLAY_TEXT} placeholder="输入水印文字" enterKeyHint="done" onChange={event => update({ text: event.target.value })} onKeyDown={blurOnEnter} />
        </label>
      )}
      {layer.kind === 'emoji' && (
        <div className="m-field">
          <span>Emoji</span>
          <div className="m-chip-row">
            {EMOJI_PRESETS.map(emoji => (
              <button key={emoji} type="button" className={`m-chip m-overlay-emoji ${layer.text === emoji ? 'active' : ''}`} onClick={() => update({ text: emoji })}>{emoji}</button>
            ))}
          </div>
          <input className="m-text-input" aria-label="自定义 Emoji" value={layer.text ?? ''} maxLength={MAX_OVERLAY_TEXT} placeholder="也可以直接输入任意 emoji" enterKeyHint="done" onChange={event => update({ text: event.target.value })} onKeyDown={blurOnEnter} />
        </div>
      )}
      {layer.kind === 'image' && (
        <div className="m-field">
          <span>图片</span>
          <button type="button" className="m-block-button outline" onClick={() => props.onRequestImage(layer.id)}>{props.isImageMissing(layer) ? '选择图片' : '重新选择图片'}</button>
        </div>
      )}
      {(layer.kind === 'text' || layer.kind === 'solid' || layer.kind === 'emoji') && (
        <div className="m-overlay-inline">
          {(layer.kind === 'text' || layer.kind === 'solid') && (
            <label>
              <span>颜色</span>
              <input type="color" value={layer.color ?? '#000000'} onChange={event => update({ color: event.target.value })} />
            </label>
          )}
          {(layer.kind === 'text' || layer.kind === 'emoji') && (
            <label>
              <span>描边</span>
              <input type="checkbox" checked={Boolean(layer.outline)} onChange={event => update({ outline: event.target.checked })} />
            </label>
          )}
        </div>
      )}
      {layer.kind === 'mosaic' && (
        <div className="m-field">
          <span>
            马赛克块大小 ·
            {' '}
            {layer.mosaicSize}
            px
          </span>
          <input aria-label="马赛克块大小" className="m-slider" type="range" min={MIN_MOSAIC_SIZE} max={MAX_MOSAIC_SIZE} step={1} value={layer.mosaicSize} onChange={event => update({ mosaicSize: Number(event.target.value) })} />
        </div>
      )}
      <div className="m-field">
        <span>
          不透明度 ·
          {' '}
          {Math.round(layer.opacity * 100)}
          %
        </span>
        <input aria-label="不透明度" className="m-slider" type="range" min={0} max={100} step={1} value={Math.round(layer.opacity * 100)} onChange={event => update({ opacity: Number(event.target.value) / 100 })} />
      </div>

      <div className="m-field">
        <span>
          出现（秒）
          <em className="m-field-hint">{formatTime(layer.start)}</em>
        </span>
        <div className="m-field-row">
          <NumberField ariaLabel="图层出现时间" min={0} max={info.duration} step={frameStep} value={layer.start} onCommit={value => props.onSpanChange(layer.id, { start: value })} />
          <button type="button" className="m-chip" onClick={() => props.onSpanChange(layer.id, { start: currentTime })}>设为播放头</button>
        </div>
      </div>
      <div className="m-field">
        <span>
          消失（秒）
          <em className="m-field-hint">{formatTime(layer.end)}</em>
        </span>
        <div className="m-field-row">
          <NumberField ariaLabel="图层消失时间" min={0} max={info.duration} step={frameStep} value={layer.end} onCommit={value => props.onSpanChange(layer.id, { end: value })} />
          <button type="button" className="m-chip" onClick={() => props.onSpanChange(layer.id, { end: currentTime })}>设为播放头</button>
        </div>
      </div>

      <div className="m-field">
        <span>关键帧之间</span>
        <div className="m-segmented" role="radiogroup" aria-label="关键帧之间">
          <button type="button" role="radio" aria-checked={layer.easing === 'linear'} className={layer.easing === 'linear' ? 'active' : ''} onClick={() => update({ easing: 'linear' })}>平滑移动</button>
          <button type="button" role="radio" aria-checked={layer.easing === 'hold'} className={layer.easing === 'hold' ? 'active' : ''} onClick={() => update({ easing: 'hold' })}>定格跳变</button>
        </div>
      </div>
    </div>
  )
}
