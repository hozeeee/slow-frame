import type { ChangeEvent } from 'react'
import type { RangeImportMode } from '../aiRanges'
import type { SpeedRange, TrimRange } from '../timeMap'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { importWarnings, tryParseRangeJson } from '../aiRanges'
import { formatTime } from '../timeMap'

interface RangeImportDialogProps {
  duration: number
  trim: TrimRange
  existingCount: number
  onImport: (ranges: SpeedRange[], mode: RangeImportMode) => void
  onClose: () => void
}

const PLACEHOLDER = `把 AI 的回复粘贴到这里，例如：
{
  "ranges": [
    { "name": "正手扣杀", "start": 3.2, "end": 4.65, "speed": 0.25 }
  ]
}`

/** 粘贴 AI 返回的区间 JSON，预览识别结果后替换或追加到现有区间。 */
export function RangeImportDialog({ duration, trim, existingCount, onImport, onClose }: RangeImportDialogProps) {
  const [text, setText] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { result, error } = useMemo(() => tryParseRangeJson(text, duration), [text, duration])
  const warnings = result ? importWarnings(result, trim) : []
  const sourceSeconds = result ? result.ranges.reduce((sum, range) => sum + range.end - range.start, 0) : 0
  const slowedSeconds = result ? result.ranges.reduce((sum, range) => sum + (range.end - range.start) / range.speed, 0) : 0

  useEffect(() => textRef.current?.focus(), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (picked)
      setText(await picked.text())
  }

  const submit = (mode: RangeImportMode) => {
    if (!result)
      return
    onImport(result.ranges, mode)
    onClose()
  }

  return createPortal(
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget)
          onClose()
      }}
    >
      <div className="modal-card range-import-card" role="dialog" aria-modal="true" aria-labelledby="range-import-title">
        <p className="section-kicker">AI IMPORT</p>
        <h2 id="range-import-title">导入 AI 区间配置</h2>
        <p>粘贴 AI 返回的 JSON，整段回复也可以，会自动提取其中的代码块。时间按原视频秒数计算。</p>
        <textarea
          ref={textRef}
          className="range-import-text"
          value={text}
          spellCheck={false}
          placeholder={PLACEHOLDER}
          aria-label="区间 JSON"
          onChange={event => setText(event.target.value)}
        />
        <div className="range-import-meta">
          <button type="button" className="text-button" onClick={() => fileRef.current?.click()}>或选择 .json 文件</button>
          {text && <button type="button" className="text-button" onClick={() => setText('')}>清空</button>}
        </div>

        {error && <p className="validation-error">{error}</p>}
        {result && (
          <div className="range-import-preview">
            <strong>
              识别到
              {' '}
              {result.ranges.length}
              {' '}
              个区间 · 共
              {' '}
              {formatTime(sourceSeconds)}
              {' → '}
              {formatTime(slowedSeconds)}
            </strong>
            <ol>
              {result.ranges.map(range => (
                <li key={range.id}>
                  <span>{range.name || '未命名'}</span>
                  <small>
                    {formatTime(range.start)}
                    {' – '}
                    {formatTime(range.end)}
                  </small>
                  <b>
                    {range.speed}
                    ×
                  </b>
                </li>
              ))}
            </ol>
            {warnings.map(item => <p key={item} className="range-import-warning">{item}</p>)}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          {existingCount > 0 && <button type="button" className="secondary-button" disabled={!result} onClick={() => submit('append')}>追加到现有区间</button>}
          <button type="button" className="primary-button" disabled={!result} onClick={() => submit('replace')}>
            {existingCount > 0 ? `替换现有 ${existingCount} 个区间` : '导入区间'}
          </button>
        </div>
        <input ref={fileRef} className="file-input" type="file" accept=".json,application/json,text/plain" onChange={event => void onFileChange(event)} />
      </div>
    </div>,
    document.body,
  )
}
