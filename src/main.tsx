import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// 默认按设备选择界面：触屏且屏幕短边不超过 600px（手机）使用移动端；
// 可通过 ?ui=mobile / ?ui=desktop 强制指定。
function prefersMobile() {
  const forced = new URLSearchParams(window.location.search).get('ui')
  if (forced === 'mobile' || forced === 'desktop')
    return forced === 'mobile'
  return window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) <= 600
}

// 两端按需加载，桌面端不会下载移动端代码，反之亦然（单文件构建时会全部内联）。
const ui = prefersMobile() ? import('./mobile/MobileApp') : import('./App')

void ui.then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
