import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 两种构建产物，通过 --mode 区分：
// - single（默认）：所有 JS/CSS 内联进 dist/single/index.html，单个可离线打开的 HTML 文件
// - web：常规多文件产物输出到 dist/web/，带哈希的静态资源放在 assets/，用于普通网站部署
export default defineConfig(({ mode }) => {
  const isWeb = mode === 'web'

  return {
    // 相对路径，部署到域名根目录或任意子路径都能正常加载资源
    base: './',
    plugins: isWeb ? [react()] : [react(), viteSingleFile()],
    build: {
      target: 'es2022',
      outDir: isWeb ? 'dist/web' : 'dist/single',
      emptyOutDir: true,
      chunkSizeWarningLimit: 4096,
      ...(isWeb
        ? {}
        : {
            assetsInlineLimit: Number.MAX_SAFE_INTEGER,
            cssCodeSplit: false,
          }),
    },
  }
})
