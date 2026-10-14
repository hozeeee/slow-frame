/** 界面选择：桌面端 / 移动端。优先级：URL 参数 ?ui= > 用户记住的选择 > 设备自动判断。 */
export type UiMode = 'mobile' | 'desktop'

const STORAGE_KEY = 'slow-frame:ui'

/** 桌面端界面在这些环境下会提示可以切换到移动端：触屏设备或窄屏窗口。 */
export const MOBILE_SUGGEST_QUERY = '(pointer: coarse), (max-width: 820px)'

function parseMode(value: unknown): UiMode | null {
  return value === 'mobile' || value === 'desktop' ? value : null
}

function forcedMode(): UiMode | null {
  return parseMode(new URLSearchParams(window.location.search).get('ui'))
}

function storedMode(): UiMode | null {
  try {
    return parseMode(window.localStorage.getItem(STORAGE_KEY))
  }
  catch {
    return null
  }
}

export function rememberMode(mode: UiMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  }
  catch {
    // 隐私模式等情况下无法写入，只影响下次打开时的默认界面。
  }
}

/** 手机：触屏且屏幕短边不超过 600px，或 UA 标明为移动设备。 */
function isPhone(): boolean {
  const coarse = window.matchMedia('(pointer: coarse)').matches
  return (coarse && Math.min(window.screen.width, window.screen.height) <= 600)
    || /Mobi|iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent)
}

export function initialMode(): UiMode {
  return forcedMode() ?? storedMode() ?? (isPhone() ? 'mobile' : 'desktop')
}

/** 用户还没有明确选择过界面时，才主动提示切换。 */
export function canSuggestMode(): boolean {
  return !forcedMode() && !storedMode()
}

/** 记住选择并重新加载为对应界面；去掉 ?ui= 参数，以后直接打开也会使用这次的选择。 */
export function switchMode(mode: UiMode) {
  rememberMode(mode)
  const url = new URL(window.location.href)
  url.searchParams.delete('ui')
  if (url.href === window.location.href)
    window.location.reload()
  else
    window.location.assign(url.href)
}
