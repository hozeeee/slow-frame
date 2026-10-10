# slow-frame

![Slow Frame 运行截图](docs/screenshot.png)

纯前端的视频区间变速工具：在浏览器里选中视频的若干时间区间，对每段设置任意播放倍率（慢放或加速），配合时长裁剪和画面裁剪，最后直接在本地导出新视频。全程基于 WebCodecs，**视频文件不会上传到任何服务器**。

## 功能

- **多格式导入**：支持 MP4 / MOV / WebM 等浏览器可解码的视频，导入时检查容器、视频和音频的编码支持情况。
- **区间变速**：在时间轴上拖动创建区间，每个区间可单独设置 `0.01×`–`16×` 的倍率，并支持拖拽调整、数值输入和命名；区间之间不允许重叠，拖动时会贴着相邻边界停住。
- **音频同步变速**：音频按线性插值重采样，时长与画面保持同步（类似磁带变速，慢放时音调变低）。
- **实时预览**：常规倍率直接用 `playbackRate` 预览；低于 `0.1×` 时改为逐帧时钟投递画面（静音）。
- **时长裁剪**：拖动时间轴两端的把手，只保留需要的片段。
- **画面裁剪**：在预览画面上框选区域，比例可选自由、原始、16:9、9:16、1:1、4:3、3:4。
- **多格式导出**：

  | 格式 | 视频编码 | 音频编码 |
  | ---- | -------- | -------- |
  | MP4  | H.264    | AAC      |
  | MOV  | H.264    | AAC      |
  | WebM | VP9      | Opus     |

  画质可选“精简 / 均衡 / 最高”三档。导出前会先检查当前浏览器有没有对应的编码器，导出过程中可以取消。
- **编辑记录**：
  - 编辑状态自动缓存到 IndexedDB，重新打开同一视频（按文件名、大小、修改时间判断）时会提示恢复；
  - 支持把编辑记录导出为 JSON 文件，之后可以再导入；
  - 有修改但尚未导出时，离开页面会弹出提醒。

## 技术栈

- React 19 + TypeScript 7 + Vite 8
- [mediabunny](https://github.com/Vanilagy/mediabunny)：纯 TypeScript 写的媒体处理库，底层用浏览器的 WebCodecs，不依赖 ffmpeg.wasm
- vite-plugin-singlefile：额外打包出单个 HTML 文件的版本
- ESLint（@antfu/eslint-config）

## 浏览器要求

需要支持 WebCodecs（`VideoDecoder` / `VideoEncoder`）的现代浏览器，推荐使用最新版 Chrome、Edge 或 Safari。能导入和导出哪些编码格式，取决于浏览器本身支持哪些编解码器。

## 快速开始

```bash
npm install
npm run dev        # 启动开发服务器
```

## 常用脚本

| 命令                   | 说明                                         |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | 启动 Vite 开发服务器                         |
| `npm run build`        | 先做类型检查，再同时构建单文件版和常规网站版 |
| `npm run build:single` | 只构建单文件版 `dist/single/index.html`      |
| `npm run build:web`    | 只构建常规网站版 `dist/web/`                 |
| `npm run preview`      | 本地预览常规网站版构建产物                   |
| `npm run typecheck`    | 只做 TypeScript 类型检查                     |
| `npm run lint`         | 运行 ESLint                                  |
| `npm run lint:fix`     | 运行 ESLint 并自动修复                       |

## 构建产物

`npm run build` 会输出两种产物：

| 目录           | 形式                                  | 适用场景                                     |
| -------------- | ------------------------------------- | -------------------------------------------- |
| `dist/single/` | 单个 `index.html`，内联全部 JS 和 CSS | 本地双击离线打开、直接发给别人使用           |
| `dist/web/`    | `index.html` + 带哈希的 `assets/`     | 部署到普通网站 / 静态托管，可利用浏览器缓存 |

两种产物的资源都用相对路径引用，部署到域名根目录或任意子路径都可以，无需额外配置。

## 目录结构

```text
src/
├── main.tsx              # 应用入口
├── App.tsx               # 顶层状态协调与布局
├── media.ts              # 媒体检查、音视频重定时、编码导出
├── timeMap.ts            # 源时间 ↔ 输出时间映射、区间/裁剪辅助函数
├── session.ts            # 编辑状态快照、IndexedDB 缓存、JSON 记录导入导出
├── styles.css            # 全局样式
└── components/
    ├── Timeline.tsx      # 时间轴：区间创建/拖拽、裁剪把手、播放头
    ├── CropOverlay.tsx   # 预览画面上的裁剪框选层
    ├── RangePanel.tsx    # 变速区间列表与参数编辑
    ├── CropPanel.tsx     # 时长/画面裁剪设置
    ├── ExportPanel.tsx   # 导出格式、画质与进度
    └── NumberInput.tsx   # 输入完成后才提交的数值输入框
```

## 实现要点

- **变速原理**：导出时借助 mediabunny 的 `Conversion` 管线，在 `process` 回调中按分段线性的时间映射改写每一帧视频的时间戳和时长；音频按区间边界切开后单独重采样。
- **超慢速处理**：`0.01×` 会把音频长度放大 100 倍，所以重采样结果按固定帧数（16384 帧）分块交给编码器，避免一次分配过大的内存。
- **裁剪坐标系**：mediabunny 传给 `process` 的时间戳以裁剪起点为 0，因此变速区间在导出前会先平移到裁剪后的坐标系。
