/**
 * “用 yt-dlp 下载网站视频”说明文档内容，桌面端与移动端共用。
 *
 * 文本支持三种行内标记：`代码`、**加粗**、[链接文字](https://…)；链接写成 #guide-章节id 时跳转到文档内对应章节。
 * 代码块按行渲染，以 # 开头的行视为注释，其余每一行都可以单独复制。
 */

export interface GuideLink {
  label: string
  href: string
  note?: string
}

export type GuideBlock
  = | { kind: 'p', text: string }
    | { kind: 'list', items: string[], ordered?: boolean }
    | { kind: 'code', title?: string, code: string }
    | { kind: 'note', tone: 'tip' | 'warn', text: string }
    | { kind: 'links', items: GuideLink[] }

export interface GuideSection {
  id: string
  chapter: string
  title: string
  /** 正文里没有、但用户可能会搜的词（同义词、报错关键字等）。 */
  keywords?: string
  blocks: GuideBlock[]
}

const p = (text: string): GuideBlock => ({ kind: 'p', text })
const ul = (...items: string[]): GuideBlock => ({ kind: 'list', items })
const ol = (...items: string[]): GuideBlock => ({ kind: 'list', items, ordered: true })
const code = (title: string, source: string): GuideBlock => ({ kind: 'code', title, code: source.trim() })
const tip = (text: string): GuideBlock => ({ kind: 'note', tone: 'tip', text })
const warn = (text: string): GuideBlock => ({ kind: 'note', tone: 'warn', text })
const links = (...items: GuideLink[]): GuideBlock => ({ kind: 'links', items })

const RELEASES = 'https://github.com/yt-dlp/yt-dlp/releases/latest'

export const GUIDE_SECTIONS: GuideSection[] = [
  // ───────────────────────── 开始之前 ─────────────────────────
  {
    id: 'overview',
    chapter: '开始之前',
    title: '这篇说明能帮你做什么',
    keywords: '介绍 简介 下载视频 获取视频 youtube bilibili 哔哩哔哩 抖音 网站视频',
    blocks: [
      p('Slow Frame 只能编辑你电脑或手机里的**本地视频文件**。如果想处理 B站、YouTube 等网站上的视频，需要先把它下载到本地。'),
      p('[yt-dlp](https://github.com/yt-dlp/yt-dlp) 是一个免费、开源的命令行下载工具，支持 YouTube、哔哩哔哩、抖音、微博、Twitter/X 等上千个网站（[完整列表](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)）。整个流程是：'),
      ol(
        '安装 yt-dlp，以及合并音视频需要的 ffmpeg；',
        '在浏览器里复制视频页面的链接；',
        '在终端里运行一行命令，得到一个视频文件；',
        '把视频文件拖进 Slow Frame 开始编辑。',
      ),
      tip('本文所有命令里的 `URL` 都要换成你复制的视频链接，并**保留两侧的英文双引号**。代码块中以 # 开头的灰色行是说明文字，不需要执行；每行命令右侧都有复制按钮。'),
      warn('请只下载你有权使用的内容，并遵守视频平台的用户协议和版权要求。下载的视频仅供个人学习、剪辑练习使用，不要二次传播他人作品。'),
    ],
  },
  {
    id: 'quickstart',
    chapter: '开始之前',
    title: '三步快速上手',
    keywords: '快速开始 入门 教程 最简单',
    blocks: [
      ol(
        '按你的系统阅读「[Windows](#guide-windows)」「[macOS](#guide-macos)」或「[Linux](#guide-linux)」一节，下载 yt-dlp 并确认 `--version` 能输出版本号。',
        '按「[ffmpeg](#guide-ffmpeg)」一节安装 ffmpeg。B站、YouTube 的高清视频都是音视频分开传输的，没有 ffmpeg 就无法合并成一个文件。',
        '运行下面这条命令，下载完成后把得到的 .mp4 拖进 Slow Frame。',
      ),
      code('推荐命令（Windows 把 yt-dlp 换成 .\\yt-dlp.exe，macOS 换成 ./yt-dlp_macos）', String.raw`
# 下载为 H.264 + AAC 编码的 MP4，导入 Slow Frame 兼容性最好
yt-dlp -t mp4 "URL"
`),
      p('遇到报错时，直接把报错里的关键字（例如 `412`、`403`、`ffmpeg`、`cookies`）输入到上方搜索框查找。'),
    ],
  },

  // ───────────────────────── 安装 yt-dlp ─────────────────────────
  {
    id: 'which-file',
    chapter: '安装 yt-dlp',
    title: '应该下载哪个文件',
    keywords: '安装 下载地址 release 发布页 exe 单文件 版本 架构 arm m1 m2 m3 apple silicon 32位',
    blocks: [
      p(`yt-dlp 官方在 GitHub 的[发布页](${RELEASES})提供已经打包好的单文件程序，下载后无需安装 Python，直接就能运行。根据你的系统选择：`),
      ul(
        '**Windows（绝大多数电脑）**：`yt-dlp.exe`',
        '**Windows ARM 电脑**：`yt-dlp_arm64.exe`；32 位老系统：`yt-dlp_x86.exe`',
        '**macOS（Intel 与 Apple 芯片通用，需 10.15 及以上）**：`yt-dlp_macos`',
        '**Linux x86_64**：`yt-dlp_linux`；**Linux ARM64**：`yt-dlp_linux_aarch64`',
        '已经装好 Python 3.10+ 的用户，也可以用 pip 安装，见「[国内下载方式](#guide-mirror)」。',
      ),
      links(
        { label: 'yt-dlp 最新版发布页', href: RELEASES, note: '页面底部 Assets 列表里就是上面这些文件' },
        { label: '官方安装说明（Wiki）', href: 'https://github.com/yt-dlp/yt-dlp/wiki/Installation' },
      ),
      tip('不要下载名字带 `.zip` 的文件（那是不能自动更新的解包版），也不要下载 `yt-dlp.tar.gz`（源码）。单文件版本以后可以直接用 `-U` 自动更新。'),
    ],
  },
  {
    id: 'mirror',
    chapter: '安装 yt-dlp',
    title: 'GitHub 打不开？国内下载方式',
    keywords: '镜像 加速 国内 墙 访问不了 下载慢 ghproxy ghfast gh-proxy 清华 tuna 阿里云 pip pypi python 代理',
    blocks: [
      p('yt-dlp、ffmpeg、Deno 的官方下载都托管在 GitHub 上，国内网络经常打不开或速度很慢。可以选择下面任意一种方式：'),
      p('**方式一：GitHub 文件加速站。**在 GitHub 下载链接前面加上加速站地址即可，例如：'),
      code('在浏览器地址栏中打开', String.raw`
https://ghfast.top/https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
https://ghfast.top/https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos
https://ghfast.top/https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux
`),
      links(
        { label: 'ghfast.top', href: 'https://ghfast.top/', note: 'GitHub Release / 文件加速' },
        { label: 'ghproxy.link', href: 'https://ghproxy.link/', note: '发布上面加速站的最新可用地址' },
        { label: 'gh-proxy.com', href: 'https://gh-proxy.com/', note: '另一个加速站，用法相同' },
      ),
      warn('加速站都是第三方个人或社区维护的，地址可能随时变化或失效，也无法保证文件未被篡改。如果介意，可以对照发布页的 `SHA2-256SUMS` 文件校验下载文件的哈希值。'),
      p('**方式二：通过国内 PyPI 镜像用 pip 安装**（需要先安装 [Python 3.10 或更高版本](https://www.python.org/downloads/)，Windows 安装时记得勾选 “Add python.exe to PATH”）：'),
      code('终端 / PowerShell', String.raw`
# 清华大学镜像
python -m pip install -U "yt-dlp[default]" -i https://pypi.tuna.tsinghua.edu.cn/simple
# 或阿里云镜像
python -m pip install -U "yt-dlp[default]" -i https://mirrors.aliyun.com/pypi/simple/
# 安装完成后直接使用 yt-dlp 命令
yt-dlp --version
`),
      p('macOS / Linux 上如果提示找不到 `python`，把命令里的 `python` 换成 `python3`。用 pip 安装的版本以后也用同一条命令更新，`yt-dlp -U` 对它无效。'),
      p('**方式三：macOS 使用 Homebrew + 清华镜像**（见「[macOS](#guide-macos)」一节），可以一次装好 yt-dlp、ffmpeg 和 Deno。'),
      links(
        { label: '清华 PyPI 镜像使用帮助', href: 'https://mirrors.tuna.tsinghua.edu.cn/help/pypi/' },
        { label: '清华 Homebrew Bottles 镜像使用帮助', href: 'https://mirrors.tuna.tsinghua.edu.cn/help/homebrew-bottles/' },
      ),
    ],
  },
  {
    id: 'windows',
    chapter: '安装 yt-dlp',
    title: 'Windows：安装与使用',
    keywords: 'win10 win11 windows powershell cmd 命令提示符 exe 环境变量 path 文件夹 smartscreen defender 杀毒 误报',
    blocks: [
      ol(
        '新建一个文件夹，例如 `C:\\yt-dlp`，把下载的 `yt-dlp.exe` 放进去。之后安装的 `ffmpeg.exe`、`ffprobe.exe`、`deno.exe` 也建议放在这里，yt-dlp 会自动找到它们。',
        '打开这个文件夹，点击窗口顶部的地址栏，输入 `powershell` 后按回车，就会在当前文件夹打开 PowerShell 窗口（Windows 11 也可以在空白处右键 →「在终端中打开」）。',
        '在 PowerShell 中运行下面的命令。注意 PowerShell 里必须写成 `.\\yt-dlp.exe`，前面的 `.\\` 不能省略。',
      ),
      code('PowerShell', String.raw`
# 查看版本，能输出类似 2026.xx.xx 的日期说明安装成功
.\yt-dlp.exe --version

# 下载视频（默认最佳画质，文件保存在当前文件夹）
.\yt-dlp.exe "https://www.bilibili.com/video/BVxxxxxxxxxx"

# 下载为 H.264 + AAC 的 MP4（推荐，需要 ffmpeg）
.\yt-dlp.exe -t mp4 "URL"

# 下载到“下载”文件夹，文件名使用视频标题
.\yt-dlp.exe -P "$HOME\Downloads" -o "%(title)s.%(ext)s" "URL"

# 指定输出文件名（扩展名由 yt-dlp 自动决定）
.\yt-dlp.exe -o "my_video.%(ext)s" "URL"
`),
      p('**可选：加入 PATH 环境变量**，以后在任何文件夹都能直接输入 `yt-dlp`：在开始菜单搜索「编辑系统环境变量」→「环境变量」→ 选中用户变量里的 `Path` →「编辑」→「新建」，填入 `C:\\yt-dlp`，一路确定后**重新打开** PowerShell。'),
      tip('如果系统提示「Windows 已保护你的电脑」，点击「更多信息」→「仍要运行」；或在 PowerShell 中执行 `Unblock-File .\\yt-dlp.exe` 解除网络下载标记。少数杀毒软件会误报 yt-dlp，从官方发布页下载的文件可以放心添加信任。'),
      tip('也可以用包管理器安装：`winget install yt-dlp.yt-dlp` 或 `scoop install yt-dlp ffmpeg deno`。它们同样从 GitHub 下载，国内网络可能失败。'),
      warn('如果把命令写进 `.bat` 批处理文件，输出模板里的 `%` 要写两遍，例如 `-o "%%(title)s.%%(ext)s"`；直接在 PowerShell 中输入则不需要。'),
    ],
  },
  {
    id: 'macos',
    chapter: '安装 yt-dlp',
    title: 'macOS：安装与使用',
    keywords: 'mac 苹果 终端 terminal zsh xattr quarantine chmod 隔离 无法验证开发者 无法打开 恶意软件 homebrew brew 权限',
    blocks: [
      p('下载 `yt-dlp_macos` 后（默认在「下载」文件夹），打开「终端」（按 ⌘ + 空格 搜索 “终端” 或 “Terminal”），依次执行：'),
      code('终端（zsh）', String.raw`
# 进入“下载”文件夹
cd ~/Downloads

# 如果下载的是 yt-dlp_macos（单文件），先移除系统的隔离标记
xattr -d com.apple.quarantine ./yt-dlp_macos
# 赋予执行权限
chmod +x ./yt-dlp_macos
# 查看版本，确认可以运行
./yt-dlp_macos --version

# 下载视频（默认最佳画质）
./yt-dlp_macos "https://www.youtube.com/watch?v=xxxxx"

# 下载为 H.264 + AAC 的 MP4（推荐，需要 ffmpeg）
./yt-dlp_macos -t mp4 "URL"

# 下载到指定目录
./yt-dlp_macos -o "~/Downloads/%(title)s.%(ext)s" "URL"

# 指定输出文件名
./yt-dlp_macos -o "my_video.mp4" "URL"
`),
      ul(
        '执行 `xattr` 时提示 `No such xattr` 说明文件本来就没有隔离标记，可以忽略，继续下一步。',
        '如果仍然弹出「无法打开“yt-dlp_macos”，因为 Apple 无法检查其是否包含恶意软件」，打开「系统设置 → 隐私与安全性」，在页面下方点击「仍要打开」。',
        '指定文件名为 `.mp4` 时，最好同时加上 `-t mp4`，否则下载到的可能是其他格式的内容；不确定时写成 `-o "my_video.%(ext)s"`，让 yt-dlp 自动决定扩展名。',
        '第一次运行会稍慢几秒，这是正常的。',
      ),
      p('**可选：安装到系统路径**，以后在任何目录直接输入 `yt-dlp`：'),
      code('终端（zsh）', String.raw`
sudo mkdir -p /usr/local/bin
sudo mv ./yt-dlp_macos /usr/local/bin/yt-dlp
yt-dlp --version
`),
      p('**另一种方式：Homebrew**。已经安装 [Homebrew](https://brew.sh/) 的用户可以一次装好全部工具；国内网络先设置清华镜像再安装：'),
      code('终端（zsh）', String.raw`
# 国内网络：临时使用清华镜像（只对当前终端窗口有效）
export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"
# 安装 yt-dlp、ffmpeg 和 Deno
brew install yt-dlp ffmpeg deno
# 以后更新
brew upgrade yt-dlp
`),
    ],
  },
  {
    id: 'linux',
    chapter: '安装 yt-dlp',
    title: 'Linux：安装与使用',
    keywords: 'ubuntu debian fedora arch deepin 统信 curl wget chmod apt 权限 aarch64 arm',
    blocks: [
      code('终端（bash）', String.raw`
# 下载到 ~/.local/bin（多数发行版已把它加入 PATH）
mkdir -p ~/.local/bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o ~/.local/bin/yt-dlp
# 国内网络可改用加速地址
curl -L https://ghfast.top/https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o ~/.local/bin/yt-dlp
# 赋予执行权限
chmod a+rx ~/.local/bin/yt-dlp
yt-dlp --version

# 安装 ffmpeg（Debian / Ubuntu）
sudo apt install ffmpeg
# 下载视频
yt-dlp -t mp4 "URL"
`),
      ul(
        'ARM64 设备（如树莓派）把文件名换成 `yt-dlp_linux_aarch64`。',
        '提示 `yt-dlp: command not found` 时，重新打开终端，或者用完整路径 `~/.local/bin/yt-dlp` 运行。',
        '不建议用 `apt install yt-dlp`：发行版仓库里的版本通常比较旧，很多网站已经无法下载。',
      ),
    ],
  },
  {
    id: 'android',
    chapter: '安装 yt-dlp',
    title: '手机上能用吗（Android / iOS）',
    keywords: '手机 安卓 android termux ios iphone ipad 移动端 平板',
    blocks: [
      p('**Android** 可以借助 Termux（手机上的 Linux 终端）运行 yt-dlp：'),
      ol(
        '从 [F-Droid](https://f-droid.org/packages/com.termux/) 或 [GitHub](https://github.com/termux/termux-app/releases) 安装 Termux（应用商店里的旧版已停止更新，不要使用）。',
        '打开 Termux，依次执行下面的命令；国内网络可以先运行 `termux-change-repo` 选择国内镜像源。',
        '下载的视频保存在手机的「Download」文件夹，回到浏览器中的 Slow Frame 选择该文件即可。',
      ),
      code('Termux', String.raw`
# 选择国内软件源（可选，按提示用方向键选择镜像）
termux-change-repo
# 安装 Python 和 ffmpeg
pkg update && pkg install python ffmpeg
# 用清华镜像安装 yt-dlp
pip install -U yt-dlp -i https://pypi.tuna.tsinghua.edu.cn/simple
# 授权访问手机存储（会弹出权限请求）
termux-setup-storage
# 下载到手机的 Download 文件夹
yt-dlp -t mp4 -P ~/storage/downloads "URL"
`),
      p('**iOS / iPadOS** 没有简单可靠的办法运行 yt-dlp。建议在电脑上下载好视频，再通过隔空投送、微信文件传输助手或网盘传到手机上。'),
      tip('手机上下载 YouTube 视频还需要 JavaScript 运行时，配置比较麻烦，也建议改在电脑上完成。'),
    ],
  },

  // ───────────────────────── 下载视频 ─────────────────────────
  {
    id: 'commands',
    chapter: '下载视频',
    title: '常用命令速查',
    keywords: '参数 选项 命令 用法 清晰度 分辨率 画质 1080 4k 格式 列表 播放列表 合集 输出 目录 文件名 模板 字幕 音频',
    blocks: [
      p('下面统一写作 `yt-dlp`。Windows 未加入 PATH 时换成 `.\\yt-dlp.exe`，macOS 单文件版换成 `./yt-dlp_macos`。多个参数可以组合使用。'),
      code('常用命令', String.raw`
# 查看版本
yt-dlp --version
# 列出视频所有可下载的清晰度和格式
yt-dlp -F "URL"
# 按 -F 列表里的 ID 下载指定的“视频+音频”
yt-dlp -f 30080+30280 "URL"
# 下载 H.264 + AAC 的 MP4（推荐用于 Slow Frame）
yt-dlp -t mp4 "URL"
# 最高只下载到 1080P（文件更小，处理更快）
yt-dlp -t mp4 -S "res:1080" "URL"
# 保存到指定文件夹
yt-dlp -P "~/Downloads" "URL"
# 自定义文件名：标题-视频ID.扩展名
yt-dlp -o "%(title)s-%(id)s.%(ext)s" "URL"
# 链接属于合集/播放列表时，只下载当前这一个
yt-dlp --no-playlist "URL"
# 只下载列表中的第 1~3 个（B站多 P 视频同样适用）
yt-dlp -I 1:3 "URL"
# 使用 cookies.txt 文件提供登录状态
yt-dlp --cookies cookies.txt "URL"
# 直接读取浏览器里的登录状态
yt-dlp --cookies-from-browser firefox "URL"
# 通过本机代理下载
yt-dlp --proxy "http://127.0.0.1:7890" "URL"
# 同时下载字幕
yt-dlp --write-subs --sub-langs "zh.*" "URL"
# 输出详细日志（排查问题时使用）
yt-dlp -v "URL"
`),
      p('**输出模板**里常用的变量：`%(title)s` 标题、`%(id)s` 视频 ID、`%(uploader)s` 上传者、`%(upload_date)s` 上传日期、`%(ext)s` 扩展名。不写 `-o` 时默认文件名是 `标题 [视频ID].扩展名`。'),
      links({ label: 'yt-dlp 全部参数说明（英文）', href: 'https://github.com/yt-dlp/yt-dlp#usage-and-options' }),
    ],
  },
  {
    id: 'best-format',
    chapter: '下载视频',
    title: '下载最适合 Slow Frame 的格式',
    keywords: '编码 codec h264 avc h265 hevc av1 vp9 webm mkv mp4 兼容 推荐 -t mp4 -S 预设',
    blocks: [
      p('Slow Frame 用浏览器内置的 WebCodecs 解码视频。网站上同一个视频往往提供 H.264、H.265（HEVC）、AV1、VP9 等多种编码，其中 **H.264 + AAC 的 MP4** 在所有浏览器里兼容性最好、预览也最流畅。'),
      code('推荐命令', String.raw`
# -t mp4 是内置预设：优先选 H.264 视频 + AAC 音频，并合并/封装为 MP4
yt-dlp -t mp4 "URL"
# 4K 视频解码和导出都很吃性能，可以限制在 1080P 以内
yt-dlp -t mp4 -S "res:1080" "URL"
`),
      ul(
        '`-t mp4` 需要 ffmpeg，也需要较新的 yt-dlp。提示 `no such option: -t` 时请先「[更新 yt-dlp](#guide-update)」。',
        '部分视频只提供 AV1 / VP9 / HEVC 编码，此时 yt-dlp 会退而选择其他编码。若 Slow Frame 提示不支持，参考「[导入 Slow Frame 时提示不支持该编码](#guide-import-errors)」用 ffmpeg 转码。',
        '下载得到 `.webm` 或 `.mkv` 文件时，也可以先直接拖进 Slow Frame 试试，Chrome / Edge 通常能解码 VP9 和 AV1。',
      ),
    ],
  },
  {
    id: 'copy-url',
    chapter: '下载视频',
    title: '如何复制视频链接（B站 / YouTube / 抖音）',
    keywords: '链接 网址 地址 url 分享 bv号 av号 多p 分p 选集 短链接 b23 app 抖音 douyin 快手 小红书 微博',
    blocks: [
      ul(
        '**电脑浏览器**：打开视频播放页，复制地址栏里的完整网址即可，例如 `https://www.bilibili.com/video/BV1xx411c7mD`。',
        '**手机 App 分享**：分享出来的往往是「标题 + 短链接」的一段文字，只复制其中 `https://` 开头的链接部分。',
        '**B站多 P 视频**：地址里的 `?p=2` 表示第 2 P。想下载全部分 P 时去掉这个参数并加上 `--yes-playlist`；只要其中几个用 `-I 1:3`。',
        '**抖音、快手、小红书**等平台经常调整接口，一般需要提供登录后的 cookies，见「[cookies.txt 是什么](#guide-cookies-intro)」。',
      ),
      warn('网址里常带有 `&`、`?` 等特殊字符，命令中必须用英文双引号把整个网址包起来，否则终端会把它拆开，出现奇怪的报错。'),
    ],
  },
  {
    id: 'update',
    chapter: '下载视频',
    title: '更新 yt-dlp（以前能下，现在突然不行）',
    keywords: '更新 升级 update upgrade -U 版本 旧版本 nightly 失效 以前能用 突然 不能用了',
    blocks: [
      p('视频网站经常改版，旧版本的 yt-dlp 很快就会失效。**遇到任何下载错误，第一步都应该是更新到最新版**再重试。'),
      code('按安装方式选择', String.raw`
# 单文件版本（yt-dlp.exe / yt-dlp_macos / yt-dlp_linux）
yt-dlp -U
# 稳定版还没修复时，可以切换到每日构建版
yt-dlp --update-to nightly
# pip 安装的版本
python -m pip install -U "yt-dlp[default]" -i https://pypi.tuna.tsinghua.edu.cn/simple
# Homebrew 安装的版本
brew upgrade yt-dlp
`),
      tip('`-U` 同样要从 GitHub 下载新版本，国内网络失败时，按「[国内下载方式](#guide-mirror)」重新下载一份最新文件覆盖旧文件即可。'),
    ],
  },

  // ───────────────────────── 常见问题 ─────────────────────────
  {
    id: 'bili-412',
    chapter: '常见问题',
    title: 'B站：HTTP Error 412: Precondition Failed',
    keywords: 'bilibili 哔哩哔哩 b站 412 precondition failed 风控 拦截 unable to download webpage json metadata 登录 cookies',
    blocks: [
      p('下载 B站视频时出现类似下面的报错：'),
      code('报错示例', String.raw`
[BiliBili] 1jjtt6VE1K: Downloading webpage
ERROR: [BiliBili] 1jjtt6VE1K: Unable to download webpage: HTTP Error 412: Precondition Failed (caused by <HTTPError 412: Precondition Failed>)
`),
      p('这是 B站的风控拦截了未登录的请求。需要**你自己提供浏览器里的登录状态（cookies）**，按顺序尝试：'),
      ol(
        '先「[更新 yt-dlp](#guide-update)」到最新版，很多时候更新后就能正常下载。',
        '在浏览器登录 B站，用「[Get cookies.txt LOCALLY](#guide-get-cookies)」扩展导出 `cookies.txt`，放到运行命令的文件夹里，下载时加上 `--cookies cookies.txt`。',
        '也可以让 yt-dlp 直接读取浏览器的登录状态：`--cookies-from-browser firefox`（Windows 上推荐 Firefox，原因见「[读取 cookies 失败](#guide-cookie-errors)」）。',
        '仍然失败时，再额外加上 Origin 和 Referer 请求头。',
        '短时间内下载太多也会触发风控，等十几分钟后再试。',
      ),
      code('示例', String.raw`
# 使用导出的 cookies.txt
yt-dlp --cookies cookies.txt "https://www.bilibili.com/video/BVxxxxxxxxxx"
# 直接读取 Firefox 的登录状态
yt-dlp --cookies-from-browser firefox "https://www.bilibili.com/video/BVxxxxxxxxxx"
# 再加上请求头
yt-dlp --cookies cookies.txt --add-header "Origin:https://www.bilibili.com" --add-header "Referer:https://www.bilibili.com" "URL"
`),
    ],
  },
  {
    id: 'bili-split',
    chapter: '常见问题',
    title: 'B站：下载后得到音视频两个文件',
    keywords: 'bilibili b站 音视频分离 两个文件 没有声音 无声 m4a f30080 f30280 合并 merge ffmpeg is not installed formats won\'t be merged dash',
    blocks: [
      p('B站（以及 YouTube 的高清画质）把画面和声音作为两个独立的文件传输，由 ffmpeg 负责合并成一个视频。如果没有安装 ffmpeg，会看到类似这样的提示，并得到 `xxx.f30080.mp4`（只有画面）和 `xxx.f30280.m4a`（只有声音）两个文件：'),
      code('提示示例', String.raw`
WARNING: You have requested merging of multiple formats but ffmpeg is not installed. The formats won't be merged
`),
      ol(
        '按「[ffmpeg](#guide-ffmpeg)」一节安装 ffmpeg，用 `ffmpeg -version` 确认能运行；',
        '删除上次下载的两个文件，重新运行下载命令，yt-dlp 会自动合并成一个文件。',
      ),
      p('已经下载好的两个文件，也可以用 ffmpeg 手动合并（不重新编码，几秒就能完成）：'),
      code('终端 / PowerShell', String.raw`
ffmpeg -i "视频.f30080.mp4" -i "音频.f30280.m4a" -c copy "合并后.mp4"
`),
      tip('如果 ffmpeg 放在了其他位置，可以用 `--ffmpeg-location "ffmpeg 所在路径"` 告诉 yt-dlp。只导入画面文件也能在 Slow Frame 中编辑，只是没有声音。'),
    ],
  },
  {
    id: 'bili-quality',
    chapter: '常见问题',
    title: 'B站：只能下载到 480P / 720P',
    keywords: 'bilibili b站 清晰度 画质 低 模糊 1080p 4k 高帧率 60帧 大会员 登录',
    blocks: [
      p('B站对未登录用户限制了清晰度：1080P 需要登录，1080P 高码率、1080P 60 帧、4K 等需要大会员。按「[cookies.txt](#guide-cookies-intro)」一节提供登录状态后，用 `-F` 查看可用的清晰度：'),
      code('示例', String.raw`
yt-dlp --cookies cookies.txt -F "URL"
yt-dlp --cookies cookies.txt -t mp4 "URL"
`),
    ],
  },
  {
    id: 'yt-bot',
    chapter: '常见问题',
    title: 'YouTube：Sign in to confirm you’re not a bot',
    keywords: 'youtube 油管 机器人 bot sign in confirm 验证 登录 年龄限制 age restricted 会员 cookies',
    blocks: [
      p('YouTube 怀疑请求来自机器人（常见于共享代理 IP），或视频有年龄限制时，会要求登录。解决方法：'),
      ol(
        '换一个代理节点，或者降低下载频率；',
        '提供 YouTube 的登录状态：`--cookies cookies.txt` 或 `--cookies-from-browser firefox`。',
      ),
      tip('YouTube 会频繁轮换网页里的 cookies，导致导出的 cookies.txt 很快失效。比较稳妥的做法是：打开浏览器无痕窗口并登录 YouTube，在同一个窗口导出 cookies.txt，然后直接关闭这个无痕窗口。建议使用不重要的小号，避免主账号受到风控影响。'),
    ],
  },
  {
    id: 'yt-js',
    chapter: '常见问题',
    title: 'YouTube：缺少 JavaScript 运行时 / 画质选项变少',
    keywords: 'youtube javascript runtime js 运行时 deno node ejs n challenge signature 签名 some formats may be missing only images 画质少 只有低画质 360p',
    blocks: [
      p('从 2025 年底开始，yt-dlp 下载 YouTube 需要借助外部的 JavaScript 运行时来完成 YouTube 的校验。缺少它时，会出现包含 `JavaScript runtime`、`n challenge`、`Some formats may be missing` 等字样的警告，只能下载到很少的格式，甚至无法下载。'),
      ol(
        '按「[Deno](#guide-deno)」一节安装 Deno（2.3.0 或更高版本）；',
        '官方单文件版本（yt-dlp.exe / yt-dlp_macos / yt-dlp_linux）已经内置所需脚本，装好 Deno 即可；用 pip 安装的需要带上 `[default]`：`pip install -U "yt-dlp[default]"`；',
        '把 yt-dlp 更新到最新版后重试。',
      ),
      tip('只下载 B站等国内网站时不需要 Deno。'),
    ],
  },
  {
    id: 'network',
    chapter: '常见问题',
    title: '连接超时 / 访问不了境外网站（代理设置）',
    keywords: '网络 超时 timed out connection reset unable to connect 代理 proxy 翻墙 梯子 vpn clash v2ray 7890 10809 socks5 youtube 下载慢 速度慢',
    blocks: [
      p('在国内下载 YouTube 等境外网站需要代理。yt-dlp 默认不一定会使用系统代理，请用 `--proxy` 明确指定本机代理软件的地址：'),
      code('示例', String.raw`
# HTTP 代理（端口以你的代理软件设置为准，常见如 7890、10809）
yt-dlp --proxy "http://127.0.0.1:7890" "URL"
# SOCKS5 代理
yt-dlp --proxy "socks5://127.0.0.1:7890" "URL"
# 下载国内网站时强制直连，不走代理
yt-dlp --proxy "" "URL"
`),
      ul(
        '端口号可在代理软件的设置页找到（通常叫「HTTP 端口」「混合端口」或「本地端口」）。',
        '下载 B站等国内网站时**不要**走境外代理，否则可能更慢或被风控。',
        '下载中途断开时，重新运行同一条命令即可继续下载未完成的部分。',
      ),
    ],
  },
  {
    id: 'http-403',
    chapter: '常见问题',
    title: 'HTTP Error 403 / 429 等访问被拒',
    keywords: '403 forbidden 429 too many requests 402 被拒 禁止访问 封禁 限流 频繁 cloudflare impersonate 伪装 user-agent',
    blocks: [
      ul(
        '**HTTP Error 403: Forbidden**：多数是 yt-dlp 版本过旧，网站已经改版，先「[更新 yt-dlp](#guide-update)」；仍然不行就提供登录 cookies，或加上 `--impersonate chrome` 模拟浏览器请求。',
        '**HTTP Error 429: Too Many Requests**：短时间内请求太多，IP 被暂时限制。等一段时间再试，或在浏览器中打开网站完成验证码后再导出 cookies；批量下载时加上 `--sleep-requests 1` 放慢速度。',
        '**HTTP Error 400: Bad Request**（使用 cookies 时）：通常是 cookies.txt 格式有问题，见「[cookies.txt 无效](#guide-cookie-errors)」。',
      ),
      code('示例', String.raw`
yt-dlp --impersonate chrome "URL"
yt-dlp --sleep-requests 1 --cookies cookies.txt "URL"
`),
    ],
  },
  {
    id: 'cookie-errors',
    chapter: '常见问题',
    title: '读取 cookies 失败 / cookies.txt 无效',
    keywords: 'cookies cookie 失败 could not copy chrome cookie database failed to decrypt dpapi app-bound 加密 chrome edge 浏览器 netscape 格式 换行 crlf 过期 失效 400',
    blocks: [
      ul(
        '**Could not copy Chrome cookie database**：Windows 上 Chrome / Edge 运行时会锁定 cookies 文件。完全退出浏览器（包括右下角托盘里的后台进程）后再试。',
        '**Failed to decrypt with DPAPI**：新版 Chrome / Edge 在 Windows 上对 cookies 做了额外加密，yt-dlp 无法直接读取。请改用 `--cookies-from-browser firefox`，或用浏览器扩展导出 cookies.txt。',
        '**cookies.txt 无效或不生效**：文件必须是 Netscape 格式，第一行应为 `# Netscape HTTP Cookie File` 或 `# HTTP Cookie File`。使用 cookies 时出现 `HTTP Error 400` 通常是换行符不对：Windows 需要 CRLF，macOS / Linux 需要 LF，可以用 VS Code 等编辑器右下角切换后保存。',
        '**之前能用，现在又不行**：cookies 有有效期，退出登录或时间久了都会失效，重新导出一份即可。',
        '**找不到文件**：`--cookies cookies.txt` 是相对于当前终端所在目录的路径；不确定时写完整路径，如 `--cookies "C:\\yt-dlp\\cookies.txt"`。',
      ),
    ],
  },
  {
    id: 'not-found',
    chapter: '常见问题',
    title: '找不到命令 / 权限不足 / 无法打开',
    keywords: '不是内部或外部命令 command not found 无法将 识别为 cmdlet permission denied 权限 拒绝 无法打开 无法验证开发者 恶意软件 path 环境变量 运行不了',
    blocks: [
      ul(
        '**Windows：「无法将“yt-dlp”项识别为 cmdlet…」或「不是内部或外部命令」**：yt-dlp 不在 PATH 中。确认终端位于 yt-dlp.exe 所在的文件夹，并写成 `.\\yt-dlp.exe`；或按「[Windows](#guide-windows)」一节加入 PATH 后重新打开终端。',
        '**macOS / Linux：`command not found`**：同上，使用 `./yt-dlp_macos` 这样的相对路径，或把文件移动到 PATH 目录中。',
        '**`permission denied`**：缺少执行权限，运行 `chmod +x ./yt-dlp_macos`（Linux 换成对应文件名）。',
        '**macOS 提示无法验证开发者 / 无法检查是否包含恶意软件**：运行 `xattr -d com.apple.quarantine ./yt-dlp_macos`，或到「系统设置 → 隐私与安全性」点击「仍要打开」。ffmpeg、Deno 等单独下载的程序同理。',
        '**`ffmpeg` / `deno` 找不到**：确认它们和 yt-dlp 在同一个文件夹，或已加入 PATH；也可以用 `--ffmpeg-location`、`--js-runtimes deno:路径` 手动指定。',
      ),
    ],
  },
  {
    id: 'url-errors',
    chapter: '常见问题',
    title: 'Unsupported URL / 链接带 & 或 ? 时报错',
    keywords: 'unsupported url 不支持 链接 网址 & ? 引号 zsh no matches found 不是内部或外部命令 播放列表 playlist 合集 下载了很多',
    blocks: [
      ul(
        '**Unsupported URL**：确认复制的是视频播放页的网址，而不是 App 分享的整段文字或首页地址；也可能是这个网站不在 [支持列表](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) 中。',
        '**zsh: no matches found** 或 **\'v\' 不是内部或外部命令**：网址里的 `?`、`&` 被终端当成了特殊符号，用英文双引号把网址包起来。',
        '**一下子开始下载很多个视频**：链接属于合集或播放列表，加上 `--no-playlist` 只下载当前视频。',
      ),
    ],
  },
  {
    id: 'format-errors',
    chapter: '常见问题',
    title: 'Requested format is not available',
    keywords: 'requested format is not available 格式 不可用 -f -F format id 清晰度',
    blocks: [
      p('指定的格式在这个视频里不存在。先用 `-F` 列出所有格式，再按第一列的 ID 选择；或者去掉 `-f` 参数，让 yt-dlp 自动选择最佳格式。'),
      code('示例', String.raw`
yt-dlp -F "URL"
# 视频 ID + 音频 ID，用加号连接
yt-dlp -f 30080+30280 "URL"
`),
      tip('登录后可用的格式会更多。如果 `-F` 列表里明显缺少高清格式，参考「[只能下载到 480P](#guide-bili-quality)」或「[YouTube 画质选项变少](#guide-yt-js)」。'),
    ],
  },
  {
    id: 'import-errors',
    chapter: '常见问题',
    title: '导入 Slow Frame 时提示不支持该编码',
    keywords: 'slow frame 导入 打不开 不支持 解码 编码格式 webcodecs hevc h265 av1 vp9 转码 转换 ffmpeg libx264 mp4 无法播放',
    blocks: [
      p('如果 Slow Frame 提示「浏览器不支持解码该视频的编码格式」，说明下载到的视频编码（常见是 HEVC / H.265，有时是 AV1）当前浏览器解不了。可以：'),
      ol(
        '用 `-t mp4` 重新下载，优先获取 H.264 编码；',
        '或者用 ffmpeg 把已有文件转码为 H.264 + AAC（需要重新编码，视频越长越慢）；',
        '换用最新版 Chrome / Edge 再试。',
      ),
      code('终端 / PowerShell', String.raw`
# 转码为兼容性最好的 MP4（crf 越小画质越高、文件越大，18~23 比较合适）
ffmpeg -i "input.mkv" -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k "output.mp4"
`),
    ],
  },
  {
    id: 'filename',
    chapter: '常见问题',
    title: '文件名太长 / 含特殊字符',
    keywords: 'file name too long 文件名 太长 特殊字符 乱码 表情 emoji 截断 restrict-filenames',
    blocks: [
      p('视频标题过长或包含特殊符号时，可能无法保存。用输出模板截短标题，或者干脆自定义文件名：'),
      code('示例', String.raw`
# 标题最多保留 80 字节
yt-dlp -o "%(title).80B [%(id)s].%(ext)s" "URL"
# 文件名只保留英文、数字等安全字符
yt-dlp --restrict-filenames "URL"
# 直接用视频 ID 作为文件名
yt-dlp -o "%(id)s.%(ext)s" "URL"
`),
    ],
  },

  // ───────────────────────── 相关软件 ─────────────────────────
  {
    id: 'ffmpeg',
    chapter: '相关软件',
    title: 'ffmpeg：合并音视频与转码',
    keywords: 'ffmpeg ffprobe 安装 下载 合并 转码 gyan btbn winget brew apt essentials 环境变量',
    blocks: [
      p('[ffmpeg](https://ffmpeg.org/) 是最常用的开源音视频处理工具。yt-dlp 用它来**合并分离的音视频**、转换封装格式，强烈建议安装。注意需要的是 ffmpeg 程序本身，不是 Python 里同名的 `ffmpeg` 包。'),
      p('**Windows**：'),
      ol(
        '打开 [gyan.dev 的构建页](https://www.gyan.dev/ffmpeg/builds/)，下载 `ffmpeg-release-essentials.zip`（也可以用 [yt-dlp 官方构建](https://github.com/yt-dlp/FFmpeg-Builds/releases) 的 `ffmpeg-master-latest-win64-gpl.zip`，GitHub 打不开时在链接前加 `https://ghfast.top/`）；',
        '解压后进入 `bin` 文件夹，把 `ffmpeg.exe` 和 `ffprobe.exe` 复制到 `yt-dlp.exe` 所在的文件夹；',
        '在该文件夹的 PowerShell 中运行 `.\\ffmpeg.exe -version`，能输出版本信息即可。',
      ),
      p('或者用包管理器：`winget install Gyan.FFmpeg`（安装后需重新打开终端）。'),
      p('**macOS**：推荐 `brew install ffmpeg`（国内网络先设置清华镜像，见「[macOS](#guide-macos)」一节）。也可以从 [ffmpeg 官网下载页](https://ffmpeg.org/download.html) 进入第三方静态构建下载，解压后同样需要 `xattr` 和 `chmod +x`。'),
      p('**Linux**：`sudo apt install ffmpeg`（Fedora 用 `sudo dnf install ffmpeg`，Arch 用 `sudo pacman -S ffmpeg`）。**Android Termux**：`pkg install ffmpeg`。'),
      code('验证安装', String.raw`
ffmpeg -version
ffprobe -version
`),
      links(
        { label: 'ffmpeg 官网下载页', href: 'https://ffmpeg.org/download.html' },
        { label: 'gyan.dev Windows 构建', href: 'https://www.gyan.dev/ffmpeg/builds/' },
        { label: 'yt-dlp 官方 FFmpeg 构建', href: 'https://github.com/yt-dlp/FFmpeg-Builds/releases' },
        { label: 'BtbN FFmpeg 构建', href: 'https://github.com/BtbN/FFmpeg-Builds/releases' },
      ),
    ],
  },
  {
    id: 'cookies-intro',
    chapter: '相关软件',
    title: 'cookies.txt 是什么，如何安全使用',
    keywords: 'cookies cookie 登录 登录态 登录状态 会员 cookies-from-browser netscape 隐私 安全 泄露 账号',
    blocks: [
      p('cookies 是网站保存在浏览器里的登录凭证。yt-dlp 本身不会登录账号，当网站要求登录（B站 412、高清画质、YouTube 人机验证、抖音等）时，就需要把浏览器里的 cookies 交给它。有两种方式：'),
      ul(
        '**导出为 cookies.txt 文件**：用「[Get cookies.txt LOCALLY](#guide-get-cookies)」扩展导出当前网站的 cookies，下载时加 `--cookies cookies.txt`。最通用、最稳定。',
        '**直接读取浏览器**：`--cookies-from-browser 浏览器名`，支持 `chrome`、`edge`、`firefox`、`safari`、`brave`、`opera`、`vivaldi`、`chromium` 等。Windows 上的 Chrome / Edge 经常读取失败，推荐 Firefox。',
      ),
      code('示例', String.raw`
yt-dlp --cookies cookies.txt "URL"
yt-dlp --cookies-from-browser firefox "URL"
# 不装扩展也能导出 cookies.txt（会导出该浏览器所有网站的 cookies，务必妥善保管）
yt-dlp --cookies-from-browser firefox --cookies cookies.txt
`),
      warn('cookies.txt 等同于你的账号登录凭证，拿到它的人可以直接登录你的账号。不要发给别人、不要上传到网盘或群聊，用完后可以删除；在网站上主动「退出登录」会让旧的 cookies 失效。'),
    ],
  },
  {
    id: 'get-cookies',
    chapter: '相关软件',
    title: 'Get cookies.txt LOCALLY 浏览器扩展',
    keywords: 'get cookies.txt locally 扩展 插件 chrome edge firefox 导出 export 应用商店 恶意软件 开发者模式 加载已解压',
    blocks: [
      p('Get cookies.txt LOCALLY 是一个开源浏览器扩展，可以把当前网站的 cookies 导出为 yt-dlp 能读取的 Netscape 格式，数据只保存在本地，不会上传。'),
      links(
        { label: 'Chrome 应用商店', href: 'https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc', note: 'Chrome、Edge 等 Chromium 内核浏览器' },
        { label: 'Firefox 附加组件', href: 'https://addons.mozilla.org/firefox/addon/get-cookies-txt-locally/' },
        { label: 'GitHub 源码', href: 'https://github.com/kairi003/Get-cookies.txt-LOCALLY', note: '应用商店打不开时手动安装' },
      ),
      p('**使用步骤**：'),
      ol(
        '安装扩展，并点击浏览器工具栏的拼图图标把它固定出来；',
        '打开要下载的网站（例如 `https://www.bilibili.com`）并**登录账号**；',
        '停留在该网站的页面上，点击扩展图标，格式保持 `Netscape`，点击 **Export** 导出当前网站的 cookies；',
        '把下载得到的 .txt 文件改名为 `cookies.txt`，放到运行 yt-dlp 命令的文件夹中；',
        '下载时加上 `--cookies cookies.txt`。',
      ),
      warn('认准名字里带 **LOCALLY** 的版本。早年同名的「Get cookies.txt」扩展已被曝光会窃取 cookies 并已从应用商店下架，如果曾经装过，请立即卸载。'),
      tip('Edge 用户打开 Chrome 应用商店链接后，按页面顶部提示「允许来自其他应用商店的扩展」即可安装。国内网络打不开 Chrome 应用商店时，可以改用 Firefox 版本；或从 GitHub 下载源码压缩包解压，在扩展管理页（`chrome://extensions` 或 `edge://extensions`）打开「开发者模式」，点击「加载已解压的扩展程序」并选择其中的 `src` 文件夹。'),
    ],
  },
  {
    id: 'deno',
    chapter: '相关软件',
    title: 'Deno：YouTube 需要的 JavaScript 运行时',
    keywords: 'deno javascript js 运行时 runtime youtube ejs node 安装 清华 镜像',
    blocks: [
      p('[Deno](https://deno.com/) 是一个 JavaScript 运行时，yt-dlp 用它运行 YouTube 的校验脚本，要求 2.3.0 或更高版本。**只下载国内网站时不需要安装。**'),
      code('安装方式（任选其一）', String.raw`
# Windows（PowerShell）
winget install DenoLand.Deno
# macOS（Homebrew）
brew install deno
# macOS / Linux（官方安装脚本）
curl -fsSL https://deno.land/install.sh | sh
# 验证
deno --version
`),
      p('**国内网络**：清华大学镜像站同步了 Deno 的发布文件，进入 [LatestRelease 目录](https://mirrors.tuna.tsinghua.edu.cn/github-release/denoland/deno/LatestRelease/)，按系统下载对应压缩包（Windows 选 `deno-x86_64-pc-windows-msvc.zip`，Apple 芯片 Mac 选 `deno-aarch64-apple-darwin.zip`，Intel Mac 选 `deno-x86_64-apple-darwin.zip`，Linux 选 `deno-x86_64-unknown-linux-gnu.zip`），解压出 `deno` / `deno.exe`：'),
      ul(
        'Windows：把 `deno.exe` 放到 `yt-dlp.exe` 所在文件夹即可被自动识别；',
        'macOS / Linux：放到 PATH 目录（如 `/usr/local/bin` 或 `~/.local/bin`）中，macOS 同样需要先执行 `xattr -d com.apple.quarantine ./deno`；',
        '注意要下载 `deno` 开头的文件，不要下载 `denort` 开头的文件。',
      ),
      links(
        { label: 'Deno 官方安装文档', href: 'https://docs.deno.com/runtime/getting_started/installation/' },
        { label: '清华镜像：Deno 最新版', href: 'https://mirrors.tuna.tsinghua.edu.cn/github-release/denoland/deno/LatestRelease/' },
        { label: 'yt-dlp EJS 说明（英文）', href: 'https://github.com/yt-dlp/yt-dlp/wiki/EJS' },
      ),
    ],
  },
  {
    id: 'terminal',
    chapter: '相关软件',
    title: '终端（命令行）入门',
    keywords: '终端 命令行 terminal powershell cmd shell 打开 cd 目录 路径 复制 粘贴 停止 中断 ctrl+c 拖拽',
    blocks: [
      ul(
        '**打开终端**：Windows 在文件夹地址栏输入 `powershell` 回车，或在开始菜单搜索「PowerShell」/「终端」；macOS 按 ⌘ + 空格 搜索「终端」；Linux 一般是 Ctrl + Alt + T。',
        '**切换目录**：`cd 文件夹路径`。macOS 可以先输入 cd 和一个空格，再把文件夹拖进终端窗口，路径会自动填好。',
        '**查看当前目录的文件**：Windows 用 `dir`，macOS / Linux 用 `ls`。',
        '**粘贴命令**：Windows 终端用 Ctrl + V 或鼠标右键；macOS 用 ⌘ + V；Linux 终端一般是 Ctrl + Shift + V。',
        '**中断正在运行的下载**：按 Ctrl + C。之后重新运行同一条命令会接着下载。',
        '**下载的文件在哪**：没有用 `-P` 或 `-o` 指定路径时，文件保存在终端当前所在的文件夹。',
      ),
    ],
  },
  {
    id: 'links',
    chapter: '相关软件',
    title: '官方链接汇总',
    keywords: '链接 官网 地址 文档 github 汇总 资源',
    blocks: [
      links(
        { label: 'yt-dlp 项目主页', href: 'https://github.com/yt-dlp/yt-dlp' },
        { label: 'yt-dlp 最新版下载', href: RELEASES },
        { label: 'yt-dlp 常见问题 FAQ（英文）', href: 'https://github.com/yt-dlp/yt-dlp/wiki/FAQ' },
        { label: 'yt-dlp 支持的网站列表', href: 'https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md' },
        { label: 'ffmpeg 官网', href: 'https://ffmpeg.org/download.html' },
        { label: 'Deno 官网', href: 'https://deno.com/' },
        { label: 'Get cookies.txt LOCALLY（GitHub）', href: 'https://github.com/kairi003/Get-cookies.txt-LOCALLY' },
        { label: 'Termux（F-Droid）', href: 'https://f-droid.org/packages/com.termux/' },
        { label: '清华大学开源软件镜像站', href: 'https://mirrors.tuna.tsinghua.edu.cn/' },
      ),
    ],
  },

  // ───────────────────────── 在 Slow Frame 里编辑 ─────────────────────────
  {
    id: 'overlay',
    chapter: '在 Slow Frame 里编辑',
    title: '水印与打码：遮挡画面中的特定区域',
    keywords: '水印 打码 马赛克 遮挡 遮盖 隐藏 logo 台标 人脸 车牌 字幕 文字 emoji 表情 图片 色块 图层 关键帧 跟随 移动 平滑 定格 插值 出现 消失 显示时段',
    blocks: [
      p('在「水印 / 打码」面板（手机上是「图层」标签页）可以添加最多 20 个图层，类型有**文字、Emoji、图片、马赛克和纯色块**。导出时图层会直接画进视频画面。'),
      ol(
        '点击添加按钮新建图层，新图层会出现在画面中央，并从当前播放位置开始显示；',
        '**暂停**视频，拖动画面上的框移动位置，拖动四角缩放大小（图片图层会保持原比例）；',
        '换到另一个时间点，再拖动一次。每次拖动都会**自动在当前时间打一个关键帧**，同一时间已有关键帧时直接修改它；',
        '播放预览，确认框能跟住要遮挡的内容，不够准就在中间多加几个关键帧。',
      ),
      ul(
        '**平滑 / 定格**：关键帧之间默认平滑移动；切换为「定格」后，框会停在上一个关键帧的位置，到下一个关键帧时直接跳过去，适合镜头切换的场景。',
        '**显示时段**：每个图层可以单独设置出现和消失的时间，旁边的按钮可以直接取当前播放位置。时间轴下方的细条就是选中图层的显示时段，菱形是它的关键帧，点击菱形可以跳过去。',
        '**叠放顺序**：列表里越靠上的图层盖在越上面，可以用上移 / 下移调整。',
        '**马赛克**取的是原画面，块大小可以在 4~64 像素之间调节；文字和 Emoji 会自动缩放到刚好放进框里。',
        '图层超出画面裁剪框的部分，导出时会被裁掉。',
      ),
      tip('关键帧只能手动设置，不会自动追踪画面中的物体。要遮挡的东西移动得越快，关键帧就要打得越密。'),
      warn('**图片不会随 JSON 编辑记录导出。**图片只保存在当前浏览器的缓存里，在其他浏览器或设备导入 JSON 后，图片图层会显示为「图片缺失」，需要重新选择图片，否则导出时会跳过这些图层。文字、马赛克等其他图层不受影响。'),
    ],
  },
]
