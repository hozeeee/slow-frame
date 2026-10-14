import { useState, useSyncExternalStore } from 'react'
import { canSuggestMode, MOBILE_SUGGEST_QUERY, rememberMode, switchMode } from '../uiMode'

const query = window.matchMedia(MOBILE_SUGGEST_QUERY)
function subscribe(onChange: () => void) {
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const getSnapshot = () => query.matches

/** 在触屏设备或窄屏窗口里打开桌面端时，提示可以切换到移动端界面。 */
export function MobileSuggestion() {
  const matches = useSyncExternalStore(subscribe, getSnapshot)
  const [dismissed, setDismissed] = useState(() => !canSuggestMode())
  if (!matches || dismissed)
    return null
  return (
    <div className="mobile-suggestion" role="dialog" aria-labelledby="mobile-suggestion-title">
      <span className="mobile-suggestion-icon" aria-hidden="true">▯</span>
      <p>
        <strong id="mobile-suggestion-title">试试移动版界面？</strong>
        <small>检测到你正在使用触屏或小屏设备。移动版为触屏操作重新设计，功能与桌面版一致。</small>
      </p>
      <div className="mobile-suggestion-actions">
        <button
          className="secondary-button"
          onClick={() => {
            rememberMode('desktop')
            setDismissed(true)
          }}
        >
          继续使用桌面版
        </button>
        <button className="primary-button" onClick={() => switchMode('mobile')}>切换到移动版</button>
      </div>
    </div>
  )
}
