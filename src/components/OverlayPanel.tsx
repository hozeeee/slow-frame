import type { MediaInfo } from '../media'
import type { OverlayKind, OverlayLayer, OverlayPatch } from '../overlay'
import {
  EMOJI_PRESETS,
  kindIcon,
  MAX_MOSAIC_SIZE,
  MAX_OVERLAY_TEXT,
  MAX_OVERLAYS,
  MIN_MOSAIC_SIZE,
  OVERLAY_KINDS,
  overlayName,
} from '../overlay'
import { formatTime } from '../timeMap'
import { NumberInput } from './NumberInput'

interface OverlayPanelProps {
  info: MediaInfo
  overlays: OverlayLayer[]
  selected: OverlayLayer | null
  currentTime: number
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

export function OverlayPanel(props: OverlayPanelProps) {
  const { info, overlays, selected, currentTime, snap, exporting } = props
  const full = overlays.length >= MAX_OVERLAYS
  // 列表按叠放顺序从上到下显示：越靠上的图层画在越上面。
  const stacked = overlays.map((layer, index) => ({ layer, index })).reverse()

  return (
    <div className="crop-card overlay-card">
      <div className="section-title-row">
        <div>
          <p className="section-kicker">WATERMARK &amp; MOSAIC</p>
          <h2>水印 / 打码</h2>
        </div>
        <span className="overlay-count">
          {overlays.length}
          {' '}
          /
          {' '}
          {MAX_OVERLAYS}
        </span>
      </div>
      <div className="overlay-add-row">
        {OVERLAY_KINDS.map(item => (
          <button key={item.kind} type="button" disabled={full || exporting} onClick={() => props.onAdd(item.kind)}>
            <b>{item.icon}</b>
            {item.label}
          </button>
        ))}
      </div>

      {overlays.length === 0
        ? (
            <div className="empty-ranges overlay-empty">
              <span>◩</span>
              <p>还没有图层</p>
              <small>添加文字、Emoji、图片、马赛克或色块，遮挡画面中的特定区域</small>
            </div>
          )
        : (
            <div className="overlay-grid">
              <div className="overlay-list" role="listbox" aria-label="图层列表">
                {stacked.map(({ layer, index }) => (
                  <div
                    key={layer.id}
                    role="option"
                    aria-selected={layer.id === selected?.id}
                    tabIndex={0}
                    className={`overlay-item ${layer.id === selected?.id ? 'selected' : ''}`}
                    onClick={() => props.onSelect(layer.id === selected?.id ? null : layer.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        props.onSelect(layer.id)
                      }
                    }}
                  >
                    <i className={`overlay-icon ${layer.kind}`}>{layer.kind === 'emoji' ? layer.text || kindIcon(layer.kind) : kindIcon(layer.kind)}</i>
                    <div className="overlay-item-text">
                      <strong>{overlayName(layer)}</strong>
                      <small>
                        {formatTime(layer.start)}
                        {' – '}
                        {formatTime(layer.end)}
                        {props.isImageMissing(layer) && <em className="outside-tag">图片缺失</em>}
                      </small>
                    </div>
                    <div className="overlay-item-actions" onClick={event => event.stopPropagation()}>
                      <button type="button" aria-label="上移一层" title="上移一层" disabled={index === overlays.length - 1} onClick={() => props.onMove(layer.id, 1)}>↑</button>
                      <button type="button" aria-label="下移一层" title="下移一层" disabled={index === 0} onClick={() => props.onMove(layer.id, -1)}>↓</button>
                      <button type="button" aria-label="删除图层" title="删除图层" className="danger" onClick={() => props.onDelete(layer.id)}>×</button>
                    </div>
                  </div>
                ))}
              </div>

              {selected
                ? <OverlayEditor {...props} layer={selected} info={info} currentTime={currentTime} snap={snap} />
                : <div className="overlay-placeholder">选中左侧的图层进行编辑</div>}
            </div>
          )}
    </div>
  )
}

function OverlayEditor(props: OverlayPanelProps & { layer: OverlayLayer }) {
  const { layer, info, currentTime, snap } = props
  const update = (patch: OverlayPatch) => props.onUpdate(layer.id, patch)
  const missing = props.isImageMissing(layer)
  const hasPrev = layer.keyframes.some(frame => frame.time < currentTime - snap)
  const hasNext = layer.keyframes.some(frame => frame.time > currentTime + snap)

  return (
    <div className="overlay-editor">
      <input
        aria-label="图层名称"
        className="range-name-input overlay-name-input"
        value={layer.name ?? ''}
        maxLength={40}
        placeholder={overlayName(layer)}
        onChange={event => update({ name: event.target.value })}
      />

      {layer.kind === 'text' && (
        <div className="overlay-field">
          <span>文字内容</span>
          <input className="overlay-text-input" value={layer.text ?? ''} maxLength={MAX_OVERLAY_TEXT} placeholder="输入水印文字" onChange={event => update({ text: event.target.value })} />
        </div>
      )}
      {layer.kind === 'emoji' && (
        <div className="overlay-field">
          <span>Emoji</span>
          <div className="aspect-row overlay-emoji-row">
            {EMOJI_PRESETS.map(emoji => (
              <button key={emoji} type="button" className={layer.text === emoji ? 'active' : ''} onClick={() => update({ text: emoji })}>{emoji}</button>
            ))}
          </div>
          <input className="overlay-text-input" value={layer.text ?? ''} maxLength={MAX_OVERLAY_TEXT} placeholder="也可以直接输入任意 emoji" onChange={event => update({ text: event.target.value })} />
        </div>
      )}
      {layer.kind === 'image' && (
        <div className="overlay-field">
          <span>图片</span>
          {missing && <p className="validation-error">图片缺失（编辑记录不包含图片），该图层不会被导出。</p>}
          <button type="button" className="secondary-button" onClick={() => props.onRequestImage(layer.id)}>{missing ? '选择图片' : '重新选择图片'}</button>
        </div>
      )}
      {(layer.kind === 'text' || layer.kind === 'solid') && (
        <label className="overlay-inline">
          <span>颜色</span>
          <input type="color" value={layer.color ?? '#000000'} onChange={event => update({ color: event.target.value })} />
        </label>
      )}
      {(layer.kind === 'text' || layer.kind === 'emoji') && (
        <label className="overlay-inline">
          <span>描边</span>
          <input type="checkbox" checked={Boolean(layer.outline)} onChange={event => update({ outline: event.target.checked })} />
        </label>
      )}
      {layer.kind === 'mosaic' && (
        <label className="overlay-slider">
          <span>
            马赛克块大小
            <b>
              {layer.mosaicSize}
              px
            </b>
          </span>
          <input type="range" min={MIN_MOSAIC_SIZE} max={MAX_MOSAIC_SIZE} step={1} value={layer.mosaicSize} onChange={event => update({ mosaicSize: Number(event.target.value) })} />
        </label>
      )}
      <label className="overlay-slider">
        <span>
          不透明度
          <b>
            {Math.round(layer.opacity * 100)}
            %
          </b>
        </span>
        <input type="range" min={0} max={100} step={1} value={Math.round(layer.opacity * 100)} onChange={event => update({ opacity: Number(event.target.value) / 100 })} />
      </label>

      <div className="overlay-field">
        <span>显示时段（秒）</span>
        <div className="time-inputs">
          <label>
            出现
            <NumberInput min={0} max={info.duration} step={0.01} value={layer.start} onCommit={value => props.onSpanChange(layer.id, { start: value })} />
          </label>
          <span>→</span>
          <label>
            消失
            <NumberInput min={0} max={info.duration} step={0.01} value={layer.end} onCommit={value => props.onSpanChange(layer.id, { end: value })} />
          </label>
        </div>
        <div className="mini-actions">
          <button type="button" onClick={() => props.onSpanChange(layer.id, { start: currentTime })}>播放头设为出现</button>
          <button type="button" onClick={() => props.onSpanChange(layer.id, { end: currentTime })}>播放头设为消失</button>
        </div>
      </div>

      <div className="overlay-field">
        <span>关键帧之间</span>
        <div className="aspect-row">
          <button type="button" className={layer.easing === 'linear' ? 'active' : ''} onClick={() => update({ easing: 'linear' })}>平滑移动</button>
          <button type="button" className={layer.easing === 'hold' ? 'active' : ''} onClick={() => update({ easing: 'hold' })}>定格跳变</button>
        </div>
      </div>

      <div className="overlay-field">
        <div className="crop-group-head">
          <strong>
            关键帧
            {' '}
            {layer.keyframes.length}
          </strong>
          <div className="overlay-key-nav">
            <button type="button" className="text-button" disabled={!hasPrev} onClick={() => props.onJumpKeyframe(layer.id, 'prev')}>‹ 上一个</button>
            <button type="button" className="text-button" disabled={!hasNext} onClick={() => props.onJumpKeyframe(layer.id, 'next')}>下一个 ›</button>
          </div>
        </div>
        <ul className="overlay-keyframes">
          {layer.keyframes.map(frame => (
            <li key={frame.time} className={Math.abs(frame.time - currentTime) <= snap ? 'current' : ''}>
              <button type="button" onClick={() => props.onSeek(frame.time)}>
                ◆
                {' '}
                {formatTime(frame.time)}
              </button>
              <button type="button" aria-label="删除关键帧" className="danger" disabled={layer.keyframes.length <= 1} onClick={() => props.onDeleteKeyframe(layer.id, frame.time)}>×</button>
            </li>
          ))}
        </ul>
        <button type="button" className="secondary-button overlay-add-key" onClick={() => props.onAddKeyframe(layer.id)}>＋ 在当前时间添加关键帧</button>
      </div>
      <p className="overlay-hint">暂停后拖动画面上的框，会自动在当前时间打关键帧。</p>
    </div>
  )
}
