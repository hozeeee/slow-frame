# GitHub Actions 使用说明

本文介绍 slow-frame 项目中 GitHub Actions 的使用方式、现有配置文件，以及 workflow 文件中常用字段的含义和配置方法。

## 一、GitHub Actions 是什么

GitHub Actions 是 GitHub 内置的 CI/CD 服务。在仓库的 `.github/workflows/` 目录下放置 YAML 文件（称为 **workflow**），GitHub 会在指定事件发生时（推送代码、提 PR、打标签、定时等）自动分配一台虚拟机（**runner**），按文件中定义的步骤执行命令。

几个核心概念：

| 概念 | 说明 |
|---|---|
| Workflow | 一个 `.yml` 文件就是一个工作流，定义「什么时候触发」和「做什么」 |
| Event | 触发工作流的事件，如 `push`、`pull_request`、`workflow_dispatch` |
| Job | 工作流中的一个任务，运行在独立的 runner 上；多个 job 默认**并行**执行 |
| Step | job 中按顺序执行的步骤，可以是一条 shell 命令（`run`），也可以是一个现成的 action（`uses`） |
| Action | 可复用的步骤单元，如 `actions/checkout`、`actions/setup-node`，来自 GitHub Marketplace |
| Runner | 执行 job 的机器，常用 `ubuntu-latest`、`macos-latest`、`windows-latest` |
| Artifact | job 产出的文件，可上传保存，供下载或在其他 job 中使用 |

## 二、本项目的配置文件

```
.github/
├── ACTIONS.md               # 本说明文档
└── workflows/
    ├── ci.yml               # 持续集成：lint + 类型检查 + 构建
    ├── deploy-pages.yml     # 部署 dist/web 到 GitHub Pages
    └── release.yml          # 打标签时发布单文件 HTML 到 Release
```

### 1. `ci.yml` —— 持续集成

- **触发**：推送到 `main`、任何 Pull Request、在 Actions 页面手动触发
- **流程**：`npm ci` → `npm run lint` → `npm run build`（内含 `tsc -b` 类型检查及 single / web 两种产物构建）→ 上传 `dist/single/index.html` 为 artifact（保留 7 天）
- **作用**：保证合入 `main` 的代码能通过代码规范检查和构建

### 2. `deploy-pages.yml` —— 部署 GitHub Pages

GitHub Pages 是 GitHub 提供的静态网站托管服务。本项目是纯前端应用，不依赖服务器端程序，因此可以直接托管。当前部署地址：

- **在线访问**：<https://hozeeee.github.io/slow-frame/>
- **触发方式**：推送到 `main`，或在 Actions 页面手动运行
- **部署流程**：安装依赖 → 构建 `dist/web` → 上传 Pages artifact → 发布到 `github-pages` 环境

#### 触发与权限

```yaml
on:
  push:
    branches: [main] # main 更新后自动部署
  workflow_dispatch: # 允许在 Actions 页面手动部署

permissions:
  contents: read # 读取仓库代码
  pages: write # 发布 GitHub Pages
  id-token: write # 获取 Pages 部署使用的 OIDC 身份令牌
```

#### 并发控制

```yaml
concurrency:
  group: pages
  cancel-in-progress: false
```

所有 Pages 部署共用 `pages` 并发组。`cancel-in-progress: false` 表示新部署会等待正在执行的部署完成，避免线上发布在中途被取消。

#### 构建任务

`build` job 在 Node.js 22 环境中执行以下步骤：

1. `actions/checkout@v4`：拉取仓库代码。
2. `actions/setup-node@v4`：安装 Node.js 22，并启用 npm 下载缓存。
3. `npm ci`：严格按照 `package-lock.json` 安装依赖。
4. `npm run build:web`：类型检查并把网站构建到 `dist/web`。
5. `actions/configure-pages@v5`：读取并配置 Pages 环境。
6. `actions/upload-pages-artifact@v3`：把 `dist/web` 上传为待部署的 Pages artifact。

#### 部署任务

`deploy` job 通过 `needs: build` 等待构建成功，然后在 `github-pages` environment 中调用 `actions/deploy-pages@v4`。部署完成后，action 返回的 `page_url` 会显示在 workflow 的部署摘要和仓库 Environments 页面中。

```yaml
deploy:
  needs: build
  runs-on: ubuntu-latest
  environment:
    name: github-pages
    url: ${{ steps.deployment.outputs.page_url }}
  steps:
    - id: deployment
      uses: actions/deploy-pages@v4
```

`vite.config.ts` 使用 `base: './'`，静态资源采用相对路径，所以部署在 `/slow-frame/` 子路径下无需修改资源基地址。首次部署前，需要在仓库 **Settings → Pages → Build and deployment** 中将 **Source** 设为 **GitHub Actions**。

### 3. `release.yml` —— 发布版本

- **触发**：推送 `v` 开头的标签
- **流程**：`npm run build:single` → 重命名为 `slow-frame-<标签名>.html` → 创建 GitHub Release 并上传该文件，自动生成更新日志
- **发布方式**：

  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```

- **重新发布**：如果要在同一个分支上把已发布的版本（如 `v0.1.0`）改为指向更新后的提交，只在本地移动 tag 并推送是不够的：远端已经存在同名 tag，普通推送会被拒绝，也不会再次触发 Release 工作流。正确做法是先更新本地 tag 的指向，再删除远端旧 tag，最后重新推送：

  ```bash
  git tag -f v0.1.0 f307cac            # 本地 tag 移到最新提交
  git push origin :refs/tags/v0.1.0    # 删除远端旧 tag
  git push origin v0.1.0               # 推送新 tag，触发 Release 工作流
  ```

  其中 `f307cac` 换成目标提交的 SHA，省略时默认指向当前 `HEAD`。查看目标提交 SHA 的常用方式：

  ```bash
  git log --oneline -n 10              # 列出最近 10 条提交，每行开头即短 SHA
  git log --oneline -n 10 main         # 查看指定分支（如 main）的最近提交
  git rev-parse --short HEAD           # 只输出当前 HEAD 的短 SHA
  git rev-parse --short origin/main    # 输出远端 main 最新提交的短 SHA（先 git fetch）
  git rev-list -n 1 v0.1.0             # 查看 tag 当前指向的提交，便于确认移动前后的变化
  ```

  也可以在 GitHub 仓库页面的 **Commits** 列表中，点击某条提交右侧的复制按钮获取完整 SHA。短 SHA（前 7 位）和完整 SHA 都可以直接用于 `git tag -f`。

## 三、首次使用步骤

1. 将项目推送到 GitHub 仓库（默认主分支名为 `main`，若不同需修改 workflow 中的 `branches`）。
2. 进入仓库 **Settings → Pages → Build and deployment**，将 **Source** 设为 **GitHub Actions**（否则 `deploy-pages.yml` 会失败）。
3. 进入仓库 **Settings → Actions → General → Workflow permissions**，确认允许 workflow 读写（`release.yml` 需要 `contents: write` 来创建 Release；文件内已声明，但组织级策略可能限制）。
4. 推送代码后，在仓库顶部 **Actions** 标签页即可查看每次运行的日志与结果。
5. 需要手动运行时，在 Actions 页面左侧选中对应 workflow，点击 **Run workflow**（需 workflow 配置了 `workflow_dispatch`）。

## 四、workflow 文件常用字段

下面是一个包含常用字段的完整骨架，后续逐项说明：

```yaml
name: CI # 工作流名称

on: # 触发条件
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions: # GITHUB_TOKEN 权限
  contents: read

concurrency: # 并发控制
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env: # 全局环境变量
  NODE_ENV: production

jobs:
  build: # job ID
    name: Build # 显示名称
    runs-on: ubuntu-latest # 运行环境
    timeout-minutes: 15 # 超时时间
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
```

### 1. `name`

工作流显示在 Actions 页面上的名称。可选，不填则显示文件路径。

```yaml
name: CI
```

### 2. `on` —— 触发条件

决定工作流何时运行，是最重要的字段之一。

| 事件 | 说明 | 常用子字段 |
|---|---|---|
| `push` | 推送提交或标签 | `branches`、`tags`、`paths`、`branches-ignore`、`paths-ignore` |
| `pull_request` | PR 创建、更新、重新打开 | `branches`（目标分支）、`types`、`paths` |
| `workflow_dispatch` | 在页面上手动触发 | `inputs`（手动输入参数） |
| `schedule` | 定时触发 | `cron`（UTC 时间） |
| `release` | Release 发布等 | `types: [published]` |
| `workflow_call` | 被其他 workflow 调用（可复用工作流） | `inputs`、`secrets` |

示例：

```yaml
on:
  # 只有 main 分支推送、且 src 或配置文件有变动时触发
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'package*.json'
      - vite.config.ts

  # 推送 v 开头的标签时触发，如 v1.0.0
  # push:
  #   tags: ['v*']

  # 目标分支为 main 的 PR
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

  # 每天 UTC 02:00（北京时间 10:00）运行
  schedule:
    - cron: '0 2 * * *'

  # 手动触发，并可填写参数
  workflow_dispatch:
    inputs:
      mode:
        description: 构建模式
        type: choice
        options: [single, web]
        default: web
```

> 注意：同一个事件（如 `push`）在 `on` 下只能出现一次，`branches` 和 `tags` 可写在同一个 `push` 里。

### 3. `permissions` —— 令牌权限

每次运行时 GitHub 会自动注入一个 `GITHUB_TOKEN`，`permissions` 用来限制它的权限。建议遵循**最小权限原则**，按需开放。

```yaml
permissions:
  contents: read # 读取仓库代码（大多数场景足够）
  # contents: write   # 创建 Release、推送提交/标签
  # pages: write      # 部署 GitHub Pages
  # id-token: write   # OIDC 身份令牌（Pages 部署、云厂商免密登录需要）
  # pull-requests: write  # 在 PR 下评论
```

可写在顶层（作用于所有 job），也可写在单个 job 内覆盖。

### 4. `concurrency` —— 并发控制

避免同一分支同时运行多个相同工作流。

```yaml
concurrency:
  group: ci-${{ github.ref }} # 同组内只运行一个
  cancel-in-progress: true # 新运行开始时取消旧的运行
```

- CI 类工作流：通常 `cancel-in-progress: true`，只关心最新提交的结果
- 部署类工作流：通常 `cancel-in-progress: false`，避免部署被中途打断

### 5. `env` —— 环境变量

可定义在三个层级，作用范围依次缩小，内层覆盖外层：

```yaml
env: # 工作流级
  NODE_ENV: production

jobs:
  build:
    env: # job 级
      VITE_APP_TITLE: slow-frame
    steps:
      - run: echo $VITE_APP_TITLE
        env: # step 级
          DEBUG: 'true'
```

### 6. `jobs` —— 任务

`jobs` 下每个键是一个 job ID（只能包含字母、数字、`-`、`_`）。常用字段：

| 字段 | 说明 | 示例 |
|---|---|---|
| `name` | 显示名称 | `name: Lint & Build` |
| `runs-on` | 运行环境 | `ubuntu-latest` / `macos-latest` / `windows-latest` |
| `needs` | 依赖的 job，等其成功后才运行 | `needs: build` 或 `needs: [lint, test]` |
| `if` | 条件执行 | `if: github.ref == 'refs/heads/main'` |
| `timeout-minutes` | 超时自动取消，默认 360 | `timeout-minutes: 15` |
| `environment` | 部署环境，可配置审批与环境专属 secrets | `environment: github-pages` |
| `strategy.matrix` | 矩阵构建，用多组参数并行运行 | 见下方示例 |
| `outputs` | 向下游 job 传递数据 | 见下方示例 |
| `steps` | 步骤列表 | 见下一节 |

**依赖与条件**：上面的 Deploy Pages 章节展示了本项目的完整写法。`deploy` 使用 `needs: build`，仅在构建成功后运行；也可以额外使用 `if` 限制 job 的执行条件。

```yaml
jobs:
  deploy:
    needs: build
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps: [...]
```

**矩阵构建**（例如在多个 Node 版本和系统上测试）：

```yaml
jobs:
  test:
    strategy:
      fail-fast: false # 某一组失败不影响其他组
      matrix:
        node: [20, 22, 24]
        os: [ubuntu-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
```

**job 间传值**：

```yaml
jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      v: ${{ steps.read.outputs.v }}
    steps:
      - uses: actions/checkout@v4
      - id: read
        run: echo "v=$(node -p "require('./package.json').version")" >> "$GITHUB_OUTPUT"

  print:
    needs: version
    runs-on: ubuntu-latest
    steps:
      - run: echo "version is ${{ needs.version.outputs.v }}"
```

### 7. `steps` —— 步骤

每个 step 要么用 `uses` 调用 action，要么用 `run` 执行命令，二者择一。

| 字段 | 说明 |
|---|---|
| `name` | 步骤名称，显示在日志中 |
| `uses` | 引用的 action，格式 `owner/repo@版本`，建议固定主版本号如 `@v4` |
| `with` | 传给 action 的参数 |
| `run` | 要执行的 shell 命令，可用 `\|` 写多行 |
| `id` | 步骤 ID，用于在后续步骤中引用其输出 `steps.<id>.outputs.xxx` |
| `if` | 条件执行，如 `if: failure()` 仅在前面失败时运行 |
| `env` | 该步骤的环境变量 |
| `working-directory` | 命令执行目录 |
| `continue-on-error` | 设为 `true` 时该步骤失败不会导致 job 失败 |
| `shell` | 指定 shell，如 `bash`、`pwsh` |

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4

  - name: Setup Node
    uses: actions/setup-node@v4
    with:
      node-version: 22
      cache: npm # 自动缓存 ~/.npm，加速 npm ci

  - name: Install & Build
    run: |
      npm ci
      npm run build

  - name: Upload on failure
    if: failure()
    uses: actions/upload-artifact@v4
    with:
      name: logs
      path: npm-debug.log
```

## 五、表达式与上下文

`${{ ... }}` 用于在 YAML 中插入表达式，常用上下文：

| 表达式 | 含义 |
|---|---|
| `github.ref` | 完整引用，如 `refs/heads/main`、`refs/tags/v0.1.0` |
| `github.ref_name` | 短名称，如 `main`、`v0.1.0` |
| `github.sha` | 当前提交 SHA |
| `github.event_name` | 触发事件名，如 `push`、`pull_request` |
| `github.actor` | 触发者用户名 |
| `github.repository` | `owner/repo` |
| `secrets.XXX` | 仓库中配置的密钥 |
| `vars.XXX` | 仓库中配置的普通变量 |
| `inputs.XXX` | `workflow_dispatch` 的输入参数 |
| `matrix.XXX` | 矩阵参数 |
| `steps.<id>.outputs.XXX` | 某个步骤的输出 |
| `needs.<job>.outputs.XXX` | 上游 job 的输出 |

常用状态函数（多用于 `if`）：`success()`（默认）、`failure()`、`always()`、`cancelled()`。

```yaml
- if: startsWith(github.ref, 'refs/tags/v')
  run: echo "这是一次版本发布"
```

> 在 `run` 中，GitHub 预置的变量也可以直接以环境变量形式读取，如 `$GITHUB_REF_NAME`、`$GITHUB_SHA`（`release.yml` 中即用此写法）。

## 六、Secrets 与 Variables

敏感信息（如部署令牌、API Key）不要写进 YAML，应在仓库 **Settings → Secrets and variables → Actions** 中配置：

- **Secrets**：加密存储，日志中自动打码，通过 `${{ secrets.NAME }}` 引用
- **Variables**：明文存储的普通配置，通过 `${{ vars.NAME }}` 引用

```yaml
- name: Deploy to Vercel
  run: npx vercel deploy --prod --token "$VERCEL_TOKEN"
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

> 来自 fork 仓库的 Pull Request 默认无法读取 secrets，这是 GitHub 的安全限制。

## 七、常用官方 / 社区 Action

| Action | 用途 |
|---|---|
| `actions/checkout@v4` | 拉取仓库代码，几乎每个 job 的第一步 |
| `actions/setup-node@v4` | 安装指定版本 Node.js，`cache: npm` 开启依赖缓存 |
| `actions/cache@v4` | 通用缓存，可自定义缓存路径和 key |
| `actions/upload-artifact@v4` | 上传构建产物 |
| `actions/download-artifact@v4` | 在其他 job 中下载产物 |
| `actions/configure-pages@v5` | 配置 GitHub Pages |
| `actions/upload-pages-artifact@v3` | 上传 Pages 站点文件 |
| `actions/deploy-pages@v4` | 部署 GitHub Pages |
| `softprops/action-gh-release@v2` | 创建 Release 并上传附件 |

## 八、常见问题

- **Pages 部署报 404 或权限错误**：检查 Settings → Pages 的 Source 是否为 GitHub Actions，以及 workflow 是否声明了 `pages: write` 和 `id-token: write`。
- **Release 创建失败（403）**：检查 `permissions.contents` 是否为 `write`，以及仓库 / 组织的 Workflow permissions 设置。
- **`npm ci` 失败**：`package-lock.json` 必须提交到仓库，且与 `package.json` 保持一致。
- **本地能过、CI 失败**：多为 Node 版本不一致，确认 `setup-node` 的 `node-version` 与本地一致（本项目为 22）。
- **工作流没有触发**：确认文件位于 `.github/workflows/` 下、分支名与 `branches` 匹配、`paths` 过滤是否排除了本次改动。
- **调试运行**：在仓库 Secrets 中添加 `ACTIONS_STEP_DEBUG=true` 可输出更详细的步骤日志。

## 参考

- [GitHub Actions 官方文档](https://docs.github.com/zh/actions)
- [Workflow 语法参考](https://docs.github.com/zh/actions/writing-workflows/workflow-syntax-for-github-actions)
- [触发事件列表](https://docs.github.com/zh/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows)
- [GitHub Marketplace](https://github.com/marketplace?type=actions)
