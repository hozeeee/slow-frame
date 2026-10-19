import type { RangeImportMode } from '../../aiRanges'
import type { SpeedRange, TrimRange } from '../../timeMap'
import { useMemo, useState } from 'react'
import { importWarnings, tryParseRangeJson } from '../../aiRanges'
import { formatTime } from '../../timeMap'
import { Sheet } from './Sheet'

interface RangeImportSheetProps {
  duration: number
  trim: TrimRange
  existingCount: number
  onImport: (ranges: SpeedRange[], mode: RangeImportMode) => void
  onClose: () => void
}

/** 移动端的 AI 区间导入：粘贴 JSON，预览识别结果后替换或追加。 */
export function RangeImportSheet({ duration, trim, existingCount, onImport, onClose }: RangeImportSheetProps) {
  const [text, setText] = useState('')
  const { result, error } = useMemo(() => tryParseRangeJson(text, duration), [text, duration])
  const warnings = result ? importWarnings(result, trim) : []

  const pasteFromClipboard = async () => {
    try {
      setText(await navigator.clipboard.readText())
    }
    catch {
      // 浏览器不允许读取剪贴板时，让用户长按输入框手动粘贴。
    }
  }

  const submit = (mode: RangeImportMode) => {
    if (!result)
      return
    onImport(result.ranges, mode)
    onClose()
  }

  return (
    <Sheet kicker="AI IMPORT" title="导入 AI 区间配置" onClose={onClose}>
      <p>粘贴 AI 返回的 JSON，整段回复也可以，会自动提取其中的代码块。</p>
      <textarea
        className="m-import-text"
        value={text}
        spellCheck={false}
        placeholder="长按此处粘贴 AI 的回复"
        aria-label="区间 JSON"
        onChange={event => setText(event.target.value)}
      />
      <div className="m-chip-row">
        {'clipboard' in navigator && 'readText' in navigator.clipboard && (
          <button type="button" className="m-chip" onClick={() => void pasteFromClipboard()}>从剪贴板粘贴</button>
        )}
        {text && <button type="button" className="m-chip" onClick={() => setText('')}>清空</button>}
      </div>

      {error && <p className="m-validation">{error}</p>}
      {result && (
        <div className="m-import-preview">
          <strong>
            识别到
            {' '}
            {result.ranges.length}
            {' '}
            个区间
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
          {warnings.map(item => <p key={item}>{item}</p>)}
        </div>
      )}

      <div className="m-sheet-actions">
        <button type="button" className="m-block-button primary" disabled={!result} onClick={() => submit('replace')}>
          {existingCount > 0 ? `替换现有 ${existingCount} 个区间` : '导入区间'}
        </button>
        {existingCount > 0 && <button type="button" className="m-block-button outline" disabled={!result} onClick={() => submit('append')}>追加到现有区间</button>}
        <button type="button" className="m-block-button ghost" onClick={onClose}>取消</button>
      </div>
    </Sheet>
  )
}
