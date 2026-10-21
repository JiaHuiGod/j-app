# J App

一个面向实际开发起步的 Electron 桌面应用工程：**Electron Forge + Vite + React 19 + TypeScript**。

项目已经处理好主进程、预加载脚本、渲染进程的边界，并把 IPC 契约集中到共享类型中。当前包含中心化配置、三档主题外观、网络代理、页面导航、按站点隔离的 Cookie 会话管理，以及 115 网盘浏览、搜索、文件拖拽/选择上传与文件管理。

![J App 运行预览](docs/preview.png)

## 技术栈

- **Electron 44** — 桌面运行时
- **Electron Forge 8** — 开发、打包与安装包制作
- **Vite 8** — 主进程、预加载与渲染层构建，渲染层支持 HMR
- **React 19 + TypeScript 6** — 严格类型的界面开发
- **Vitest + Testing Library** — 渲染层单元测试
- **Zod** — 集中配置的结构校验
- **Oxlint + Oxfmt** — 静态检查与代码格式化
- **pnpm** — 依赖管理

## 快速开始

环境要求：Node.js `>= 22.12`，pnpm 11（仓库声明了 `packageManager`，Corepack 可直接识别）。

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会启动 Forge 开发环境。渲染层支持 Vite HMR；主进程与预加载脚本变更后会自动重启应用。

## 常用命令

| 命令                  | 说明                                     |
| --------------------- | ---------------------------------------- |
| `pnpm dev`            | 启动开发环境（`pnpm start` 同义）        |
| `pnpm typecheck`      | 运行 TypeScript 类型检查                 |
| `pnpm lint`           | 使用 Oxlint 检查源码                     |
| `pnpm lint:fix`       | 自动修复可修复的 lint 问题               |
| `pnpm format`         | 使用 Oxfmt 格式化代码                    |
| `pnpm format:check`   | 检查格式是否符合规范                     |
| `pnpm icons:generate` | 从 `public/favicon.svg` 重新生成应用图标 |
| `pnpm test`           | 运行一次单元测试                         |
| `pnpm test:watch`     | 监听模式运行测试                         |
| `pnpm check`          | 依次执行类型检查、lint、格式检查与测试   |
| `pnpm precommit`      | 手动执行提交流程（自动修复 + 完整校验）  |
| `pnpm package`        | 打包当前平台的未压缩应用                 |
| `pnpm make`           | 生成当前平台的安装包                     |

## Git 提交钩子

项目通过 Husky 在 `git commit` 前执行 [.husky/pre-commit](.husky/pre-commit)，流程分两步：

1. `lint-staged` 只处理本次暂存的文件：`oxlint --fix` 自动修复可修复的 lint 问题，`oxfmt --write` 统一格式，并把修复结果重新加入暂存区；
2. 执行完整的 `pnpm check`，再次验证类型、lint、格式和测试。

任何一步失败都会中止提交。`pnpm install` 会通过 `prepare` 脚本自动安装钩子；也可以随时手动运行：

```bash
pnpm precommit
```

如果遇到紧急情况需要绕过检查，可以使用 `git commit --no-verify`，但不要把它当作常规流程。

## 目录结构

```text
j-app/
├─ docs/
│  ├─ preview.png               # 主界面截图
│  ├─ preview-dark.png          # 深色概览截图
│  ├─ settings-page.png         # 浅色设置页
│  ├─ settings-dark.png         # 深色设置页
│  ├─ cookie-dialog.png         # 添加站点登录弹窗
│  ├─ clear-all-dialog.png      # 清理全部站点确认弹窗
│  ├─ cookie-sessions.md        # 站点 Cookie 会话功能文档
│  ├─ drive-115.md              # 115 网盘浏览与文件操作文档
│  ├─ themes.md                 # 主题与外观功能文档
│  ├─ proxy-dialog.png          # 网络代理弹窗
│  ├─ proxy-saved.png           # 开启代理后的重启提示
│  └─ proxy-saved-off.png       # 关闭代理后的重启提示
├─ public/
│  └─ favicon.svg               # 网页 favicon，也是应用图标的唯一源文件
├─ resources/
│  ├─ icon.png                  # 512px 通用图标，开发窗口与 Linux 打包使用
│  ├─ icon.ico                  # Windows 应用、任务栏与安装器图标
│  └─ icon.icns                 # macOS 应用图标
├─ scripts/
│  └─ generate-icons.mjs        # 由 favicon.svg 生成各平台图标
├─ .husky/
│  └─ pre-commit                # Git 提交前自动修复与校验
├─ .lintstagedrc.json           # 暂存文件的 Oxlint/Oxfmt 自动修复规则
├─ src/
│  ├─ main/                     # 主进程：拥有系统权限
│  │  ├─ appearance/
│  │  │  └─ theme.ts            # nativeTheme、主题持久化与启动应用
│  │  ├─ connections/
│  │  │  ├─ partition-cleanup.ts # 启动时清理无主站点分区
│  │  │  ├─ partition.ts         # 分区命名与无主分区识别
│  │  │  ├─ session-manager.ts   # 登录窗口、持久 Session 与 Cookie 生命周期
│  │  │  ├─ login-validation.ts  # 115 登录完成校验
│  │  │  ├─ persist-cookies.ts   # 将 115 会话 Cookie 提升为持久 Cookie
│  │  │  └─ site-profile.ts      # 站点会话的桌面 Chrome UA 兼容配置
│  │  ├─ drive/
│  │  │  ├─ accounts.ts          # 识别可用的 115 站点连接
│  │  │  ├─ detection.ts         # 115 登录地址识别
│  │  │  ├─ ipc.ts               # 网盘 IPC 结果封装
│  │  │  ├─ mapper.ts            # 115 文件响应归一化
│  │  │  ├─ mapper.test.ts       # 115 数据映射测试
│  │  │  └─ 115.ts               # 目录列表、当前目录搜索与登录检测
│  │  ├─ network/
│  │  │  └─ proxy.ts            # 启动时应用代理、代理连接测试
│  │  ├─ settings/
│  │  │  ├─ defaults.ts         # 默认配置
│  │  │  ├─ schema.ts           # Zod 配置校验与版本迁移
│  │  │  ├─ schema.test.ts      # 配置校验测试
│  │  │  └─ store.ts            # 单文件配置仓库、原子写入与坏文件恢复
│  │  ├─ index.ts               # 应用生命周期、单实例、启动流程
│  │  ├─ ipc.ts                 # ipcMain 处理器
│  │  ├─ security.ts            # CSP 与 webview 防护
│  │  └─ window.ts              # BrowserWindow、导航与外链策略
│  ├─ preload/                  # 预加载：受控 API 边界
│  │  └─ index.ts               # contextBridge 暴露 window.desktop
│  ├─ renderer/                 # 渲染进程：只负责 UI
│  │  ├─ components/
│  │  │  ├─ AddSiteDialog.tsx    # 添加站点或仅保存预设
│  │  │  ├─ AppMark.tsx          # 与桌面图标一致的内联 SVG 标志
│  │  │  ├─ ClearAllSitesDialog.tsx # 清理全部站点确认弹窗
│  │  │  ├─ GlobeIcon.tsx        # 网络代理与站点图标
│  │  │  ├─ ProxyDialog.tsx      # 代理配置、测试与重启提示弹窗
│  │  │  ├─ ProxyDialog.module.css # 代理弹窗样式
│  │  │  ├─ SiteDialogs.module.css # 添加站点与清理全部弹窗共享样式
│  │  │  ├─ ThemeSettings.tsx    # 三档主题选择与预览
│  │  │  ├─ ThemeSettings.module.css # 主题选择器样式
│  │  │  ├─ TitleBar.tsx         # 自定义标题栏、导航与窗口控制
│  │  │  └─ TitleBar.module.css  # 标题栏样式、暗色与响应式规则
│  │  ├─ hooks/
│  │  │  └─ useAppInfo.ts       # IPC 数据加载与重试
│  │  ├─ lib/
│  │  │  └─ errors.ts           # IPC 错误消息整理
│  │  ├─ pages/
│  │  │  ├─ OverviewPage.tsx     # 概览页
│  │  │  ├─ OverviewPage.module.css # 概览布局与运行环境
│  │  │  ├─ DrivePage.tsx        # 115 网盘浏览、搜索与文件操作
│  │  │  ├─ DrivePage.module.css # 网盘页头、搜索与文件列表
│  │  │  ├─ SettingsPage.tsx     # 外观、账号、资源提示与数据清理
│  │  │  └─ SettingsPage.module.css # 设置页与站点连接
│  │  ├─ styles/
│  │  │  ├─ global.css          # 全局样式入口
│  │  │  ├─ tokens.css          # 设计 Token、亮/暗变量
│  │  │  ├─ base.css            # reset、窗口外壳、页脚与全局暗色规则
│  │  │  ├─ page.module.css     # 页面共享布局与排版
│  │  │  ├─ ui.module.css       # 共享按钮、加载指示器与提示框
│  │  │  └─ reduced-motion.css  # 减少动画偏好
│  │  ├─ App.test.tsx           # 渲染层测试
│  │  ├─ App.tsx                # 页面切换与全局状态
│  │  ├─ navigation.ts          # 主导航配置
│  │  └─ main.tsx               # React 入口
│  ├─ shared/                   # 三端共享的纯类型与契约
│  │  ├─ appearance.ts          # 主题偏好与解析状态
│  │  ├─ connections.ts         # 站点连接与 Cookie 摘要类型
│  │  ├─ drive.ts               # 网盘账号、目录、文件操作与上传契约
│  │  ├─ ipc.ts                 # 通道名、AppInfo、DesktopApi
│  │  ├─ settings.ts            # 应用设置与代理数据类型
│  │  └─ window.d.ts            # window.desktop 的全局类型
│  └─ types/
│     └─ electron-forge.d.ts    # Forge Vite 注入变量的类型
├─ index.html                   # 渲染层 HTML 入口
├─ forge.config.mts             # Forge、Maker 与 Fuses 配置
├─ vite.main.config.mts
├─ vite.preload.config.mts
├─ vite.renderer.config.mts
├─ vitest.config.mts
├─ tsconfig.json
├─ .oxlintrc.json
└─ .oxfmtrc.json
```

`@shared/*` 别名在 TypeScript、三个 Vite 配置和 Vitest 中保持一致，用来引用跨进程契约。进程内部代码使用相对路径，跨边界代码使用别名，避免目录移动时产生大量路径修改。

## 样式组织

`src/renderer/styles/global.css` 只加载全局基础样式：

```css
@import './tokens.css';
@import './base.css';
@import './reduced-motion.css';
```

- `tokens.css`：颜色、字体、尺寸变量，以及亮/暗两套根变量；
- `base.css`：reset、应用外壳、页脚、全局 `h1` 与全局暗色背景；
- `reduced-motion.css`：操作系统“减少动画”偏好的全局兜底；
- `page.module.css`：页面共享的内容宽度、网格、标题排版和标签；
- `ui.module.css`：共享按钮、Spinner 和提示框；
- 其余样式全部放在组件或页面旁，通过 CSS Modules 显式导入。

每个功能模块自己负责以下内容，不再依赖集中式覆盖：

- 亮色与暗色规则；
- 980px / 680px 断点；
- 组件进入动画的局部 `@keyframes`；
- 只属于该组件的状态修饰符。

这样删除或移动组件时，样式会一起被删除或移动，不会留下无法判断归属的全局选择器。

## 应用图标

`public/favicon.svg` 同时承担两个角色：

- 通过 `index.html` 的 `<link rel="icon">` 显示为页面 favicon；
- 作为应用图标源文件，由 `pnpm icons:generate` 生成 `resources/icon.png`、`icon.ico` 和 `icon.icns`。

Forge 打包时使用 `resources/icon`：Windows 自动选择 ICO、macOS 选择 ICNS、Linux 选择 PNG，并把对应图标写入应用和安装器。开发环境中的 `BrowserWindow` 直接加载 `resources/icon.png`，打包后从 `extraResource` 读取。

更换图标时，**只需替换 `public/favicon.svg` 并重新运行 `pnpm icons:generate`**，无需改动窗口或打包配置。建议保留 1:1 的 `viewBox` 和透明圆角，避免不同尺寸下的裁切差异。生成文件已提交到仓库，因此常规开发和打包不依赖图标生成步骤。

## 自定义标题栏

应用使用自定义标题栏替代系统原生标题栏：

- Windows / Linux 使用无边框窗口，由渲染层绘制最小化、最大化和关闭按钮；
- macOS 使用 `hiddenInset`，保留原生红绿灯，隐藏自定义窗口按钮；
- 标题栏整体设置为 `-webkit-app-region: drag`，导航和窗口按钮等交互元素设置为 `no-drag`。

布局和大致的扩展位置在 [`src/renderer/components/TitleBar.tsx`](src/renderer/components/TitleBar.tsx)，对应样式在同目录的 `TitleBar.module.css`：

- 导航区域：数据驱动的主导航，当前包含“概览 / 网盘 / 设置”；
- 工具区域：全局工具按钮区域，目前包含“网络代理”入口，也可继续添加搜索、通知等操作；
- 中间留白同时作为拖拽窗口的区域。

窗口控制通过 `window.desktop.windowControls` 暴露，渲染层拿不到原始 `ipcRenderer`。主进程根据 IPC 发送者定位窗口，并在最大化状态变化时广播事件，按钮图标会随之切换。开发模式启动时会自动在独立窗口打开 DevTools，也可以使用 `F12` 或 `Ctrl/Cmd + Shift + I` 手动切换；生产构建不会自动打开。

## 主导航与页面

主导航目前提供三个页面：

- **概览**：现有工程自检与运行环境
- **网盘**：115 网盘浏览、当前目录搜索、文件选择/拖拽上传、新建文件夹、重命名、Ctrl 多选、批量移动与删除
- **设置**：应用主题外观与站点账号管理，网络代理仍保持从标题栏独立打开

导航配置在 [`src/renderer/navigation.ts`](src/renderer/navigation.ts)。页面切换由 `App.tsx` 管理，没有引入路由依赖；切换到网盘页时会保留上次目录、滚动位置、选中项和搜索状态。

网盘页通过已保存的 115 站点连接读取目录，不向渲染层暴露 Cookie。当前支持文件选择/拖拽上传、新建文件夹、重命名、Ctrl 多选、批量移动和删除，暂不支持拖拽文件夹；下载尚未实现。实现细节见 [115 网盘文档](docs/drive-115.md)。

设置页面：

![设置页：外观与站点账号](docs/settings-page.png)

页面复用当前视觉 Token；概览使用 `page.module.css` 的内容栅格，网盘使用 `DrivePage.module.css` 的工作区布局，设置页在 `SettingsPage.module.css` 中维护自己的页面结构。窗口宽度低于 980px 时会自动调整布局。

新增页面时：

1. 在 `navigation.ts` 中加入新的导航项；
2. 在 `src/renderer/pages/` 中创建页面组件和同名 `.module.css`；
3. 优先复用 `page.module.css` 的页面布局与 `ui.module.css` 的控件；
4. 在 `App.tsx` 中注册页面渲染分支。

当页面需要浏览器历史、深链或返回/前进能力时，再引入 React Router（Electron 下使用 `HashRouter`），当前阶段不提前增加依赖。

## 主题与外观

设置页提供三档主题：

- **浅色**：默认值，始终使用明亮界面；
- **深色**：始终使用暗色界面；
- **跟随系统**：随操作系统外观自动切换。

主题保存在 `settings.json` 的 `appearance.theme`，主进程在创建窗口前写入 `nativeTheme.themeSource`，因此首屏直接使用正确主题，不会出现浅色闪烁。渲染层通过 `@media (prefers-color-scheme: dark)` 选择整套暗色 Token，并同步 `color-scheme`、滚动条、输入控件和原生弹窗背景。

深色设置页：

![深色设置页](docs/settings-dark.png)

深色概览：

![深色概览](docs/preview-dark.png)

主题切换会立即生效并持久化；系统模式下操作系统变更会由 Chromium 自动反映到界面，不需要重启。站点登录窗口使用匹配的窗口背景，但第三方网页本身的颜色由站点控制。

完整设计、CSS 策略、配置迁移和验证记录见 [主题与外观文档](docs/themes.md)。

## 站点 Cookie 会话

设置页现在可以管理多个需要登录的站点：

- 每个连接使用独立的 `persist:japp-site-<uuid>` Session，同一站点可保存多个账号；
- 添加站点时可以“仅保存站点”作为预设，不打开登录窗口；之后从列表随时登录；
- 用户通过独立的登录窗口手动登录，关闭窗口后应用检测并保存 Cookie；
- Cookie 由 Chromium 加密持久化，不进入 `settings.json`、React state 或 IPC 返回值；
- 登录 Session 复用当前代理配置；
- 站点会话使用标准桌面 Chrome UA 和 `Accept-Language`，避免普通网站把 Electron 默认 UA 当作不兼容客户端；
- 保存前调用 `cookies.flushStore()`，重启应用后仍保持登录态；
- 设置页会提示每个站点都会增加独立的内存、缓存和磁盘占用；
- 支持移除单个站点，也支持带确认的“清理全部站点数据”；
- 应用启动时会扫描并删除已没有连接元数据的无主站点 partition；
- 移除连接会清理对应 Session 的 Cookie、缓存和本地存储。

清理全部站点数据需要二次确认：

![清理全部站点数据](docs/clear-all-dialog.png)

站点访问兼容性需要明确边界：标准 Chrome UA 只解决 Electron 默认 UA 被普通网站误判的问题，**不处理 Cloudflare 挑战、CAPTCHA、地区限制或账号风控**。如果同一网络下普通浏览器正常而应用仍被拦截，应优先使用站点官方 API 或联系站点，不要通过伪造 clearance、轮换代理或反检测手段绕过访问控制。

详细的数据模型、登录流程、安全边界、生命周期、清理策略、内部 API 和已知限制见 [站点 Cookie 会话文档](docs/cookie-sessions.md)。

## 集中配置与网络代理

### 配置存储

所有非敏感运行时配置集中保存在一个文件中：

```text
app.getPath('userData')/settings.json
```

在 Windows 下即 `%APPDATA%\J App\settings.json`。当前结构：

```json
{
  "schemaVersion": 3,
  "network": {
    "proxy": {
      "enabled": true,
      "protocol": "http",
      "host": "127.0.0.1",
      "port": 7890
    }
  },
  "connections": {
    "sites": [
      {
        "id": "0f2a63a7-0a9f-4b0a-9d0b-6b8e1c1a2f5d",
        "name": "GitHub",
        "loginUrl": "https://github.com/login",
        "createdAt": "2026-10-21T02:00:00.000Z",
        "lastLoginAt": "2026-10-21T02:10:00.000Z"
      }
    ]
  },
  "appearance": {
    "theme": "system"
  }
}
```

这是有意设计成“一个中心配置仓库”，而不是每个功能各自写一个文件或使用 `localStorage`：

- **只有主进程读写文件**。渲染层通过 `window.desktop` 的窄接口访问，避免多处写入、路径漂移和权限问题。
- **结构集中在 `src/shared/settings.ts`**。新增设置时增加 section（如 `appearance`、`editor`），配置文件仍是同一个。
- **带 `schemaVersion` 并用 Zod 校验**。不符合当前结构的文件会被移到 `settings.invalid-<timestamp>.json` 备份，再恢复默认值，避免静默损坏。版本 1/2 配置会自动迁移到版本 3：补充空的 `connections`，并写入 `appearance.theme = "system"`。
- **原子写入**。先写同目录临时文件、同步落盘，再 rename 到目标文件，避免中途退出留下半截 JSON。
- **不用 `.env`**。`.env` 是构建时配置，不是用户运行时状态；也不应把用户代理写进仓库。
- **配置与凭据分层**。站点 Cookie 属于登录凭据，不进入 `settings.json`，而是交给 Chromium 的加密持久分区。集中配置只保存站点 ID、名称、URL 和登录时间。
- **不把配置接口做成一个巨大的设置页**。统一存储不等于把所有 UI 堆在一起，网络代理这类全局能力由标题栏上下文入口打开独立弹窗；外观与账号连接则放在设置页集中管理。

后续新增配置时，在 `AppSettings`、Zod schema、默认值和对应的 IPC 方法中扩展同一个结构。若修改已有字段的语义，需要提升 `schemaVersion` 并在 store 中加入迁移逻辑。当前版本不保存账号密码；Cookie 由独立 Session 保存，不写入 JSON；如果将来需要代理认证，密码应使用 Electron `safeStorage` 单独加密。

### 网络代理

标题栏右侧的“代理”按钮会打开独立弹窗，不进入设置页面。按钮使用状态点颜色表示当前状态：绿色为已开启，灰色为未开启。

![网络代理设置](docs/proxy-dialog.png)

- 支持 HTTP、HTTPS 和 SOCKS5，自定义主机与端口；
- 关闭自定义代理时使用系统代理设置；
- `localhost`、`127.0.0.1`、`::1` 等本地地址始终直连；
- 连接测试通过独立的内存 Session 访问 Google 和 GitHub，不修改当前窗口的网络状态，超时为 8 秒；
- 保存后提示配置已写入，并要求重启应用生效；保存成功页会明确区分“已开启”和“已关闭”；
- 可以选择“立即重启”（`app.relaunch()`）或稍后手动重启。

![保存代理后的重启提示](docs/proxy-saved.png)

关闭自定义代理时，保存结果会明确显示为“已关闭”，并说明重启后会恢复系统代理：

![关闭代理后的重启提示](docs/proxy-saved-off.png)

应用启动时会先读取 `settings.json`，在创建窗口前通过 `session.defaultSession.setProxy()` 应用代理，并关闭旧连接池，避免复用之前的代理连接。

站点登录 Session 和未来抓取任务不会自动继承默认 Session 的代理配置。`session-manager.ts` 在打开登录窗口和返回站点 Session 前调用 `applyProxyToSession()`，保证主窗口、登录窗口和后台请求使用同一份代理设置。代理修改仍需重启应用后生效。

当前首版不支持需要账号密码的代理，也不开放自定义 bypass 列表；基础能力位于 [`src/main/network/proxy.ts`](src/main/network/proxy.ts)。

## 进程边界

### Main

`src/main` 负责窗口、生命周期、原生能力和所有 IPC 处理器。这里可以直接使用 Node.js API。业务能力按模块拆分到独立文件，再由 `index.ts` 组装；不要把所有逻辑都堆进入口文件。

### Preload

`src/preload/index.ts` 只暴露明确声明的方法，不把 `ipcRenderer` 或 Node 能力直接交给页面：

```ts
contextBridge.exposeInMainWorld('desktop', Object.freeze(desktopApi));
```

类型来自 `src/shared/ipc.ts` 中的 `DesktopApi`，渲染层通过 `window.desktop` 获得完整补全。网络代理通过 `window.desktop.settings` 的窄接口访问，主题通过 `window.desktop.appearance` 访问，站点会话通过 `window.desktop.connections` 访问；不暴露文件路径或任意读写能力。

### Renderer

React 代码没有 Node.js 权限，只能通过 `window.desktop` 请求主进程能力。当前示例用 `useAppInfo` 展示了加载、成功、失败和重试四种状态。

## 扩展一个 IPC 调用

1. 在 `src/shared/ipc.ts` 中增加通道名和数据类型，并把方法加入 `DesktopApi`。

```ts
export const IpcChannel = {
  GetAppInfo: 'app:get-info',
  OpenFile: 'dialog:open-file',
} as const;

export interface DesktopApi {
  getAppInfo: () => Promise<AppInfo>;
  openFile: () => Promise<string | null>;
}
```

2. 在 `src/main/ipc.ts` 中注册处理器，只返回可序列化的数据。

```ts
ipcMain.handle(IpcChannel.OpenFile, async () => {
  // 在这里校验参数并调用 Electron / Node API
});
```

3. 在 `src/preload/index.ts` 中转发调用。

```ts
const desktopApi: DesktopApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannel.GetAppInfo),
  openFile: () => ipcRenderer.invoke(IpcChannel.OpenFile),
};
```

4. 在 React 组件或 hook 中使用 `window.desktop.openFile()`。不要在前端直接读取文件系统。

## 默认安全策略

工程在初始状态就启用了以下措施：

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`webviewTag: false`；
- 通过 `src/main/security.ts` 为页面注入按环境区分的 CSP；开发环境仅为 HMR 放开必要来源；
- 主应用窗口拒绝新窗口请求，只有 `https:` 链接会交给系统浏览器；
- 站点登录窗口是受控例外：不使用应用 preload，不启用 Node，只允许 HTTPS（本地回环允许 HTTP），并继承同一个独立 Session；
- 阻止跨应用导航，拒绝页面挂载 `<webview>`；
- 窗口控制走受限的 `window.desktop.windowControls` IPC，不向渲染层暴露 `ipcRenderer`；
- 站点连接按 UUID 使用独立持久 Session，Cookie 不进入配置、React state、URL、日志或 IPC 返回值；
- 提供单站点移除和“清理全部站点数据”，启动时自动删除没有连接元数据的无主站点 partition；
- 站点会话使用标准桌面 Chrome UA 和语言头，仅用于普通网站兼容；工程不实现 Cloudflare/CAPTCHA 绕过；
- 用户配置由主进程校验和原子写入，损坏文件会先备份；代理测试使用隔离 Session；
- 开启 Electron Forge Fuses，包括 ASAR 完整性校验、禁用 `RunAsNode` 等；
- 打包时启用 ASAR。

上线前仍需要补充 **代码签名、自动更新策略、崩溃上报与最小化权限审计**。CSP 中的开发环境例外只应在开发服务器下生效，不要在发布版本中放宽。

## 应用标识与发布

核心信息位于 `package.json`：

```json
{
  "name": "j-app",
  "productName": "J App",
  "version": "0.1.0"
}
```

在发布前至少检查：

1. `productName`、`version`、`description`、作者信息和 `LICENSE`；
2. Windows 的 AppUserModelId（`src/main/index.ts`）和打包 Bundle ID；
3. 如果替换了图标，执行 `pnpm icons:generate` 并检查三个平台格式；
4. `forge.config.mts` 中的 Maker 与签名配置；
5. 是否需要自动更新（Squirrel / 其他更新通道）。

`pnpm make` 的产物位于 `out/`。当前 Maker 配置覆盖 Windows（Squirrel）、macOS（ZIP）、Linux（DEB / RPM）；签名与公证未配置。

## 约定

- 所有新增能力优先在 `src/shared/ipc.ts` 定义契约，再分别实现主进程和预加载层。
- TypeScript 开启 `strict`、`noUncheckedIndexedAccess`、`verbatimModuleSyntax` 等严格选项。
- 渲染层组件测试与组件放在一起，文件名使用 `*.test.tsx`。
- 使用 LF 换行和 2 个空格缩进，由 `.editorconfig`、`.gitattributes` 和 Oxfmt 统一。
- 推荐安装 `.vscode/extensions.json` 中声明的 Oxc 与 EditorConfig 插件。

## License

MIT © 2026 jia
