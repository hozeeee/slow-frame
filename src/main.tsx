import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initialMode } from './uiMode'

// 两端按需加载，桌面端不会下载移动端代码，反之亦然（单文件构建时会全部内联）。
const ui = initialMode() === 'mobile' ? import('./mobile/MobileApp') : import('./App')

void ui.then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
