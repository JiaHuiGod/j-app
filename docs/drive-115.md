# 115 网盘浏览与文件操作

## 1. 功能目标

网盘页复用设置中已经保存的 115 站点连接，展示并管理 115 网盘目录，不读取或返回 Cookie 值。

当前范围：

- 自动识别登录地址属于 `115.com` / `*.115.com` 的站点连接；
- 只使用一个 115 账号；
- 浏览根目录和文件夹；
- 当前目录内搜索；
- 面包屑返回上级、刷新、分页加载更多；
- 双击文件夹进入下一层；
- 上传本地文件到当前目录，支持文件选择和拖拽，并显示逐文件进度；
- 新建文件夹、重命名、移动、删除；
- 未登录、登录失效、无账号、空目录、网络错误均有独立状态；
- 登录失效时可以直接打开现有登录窗口重新登录。

当前范围**不包含下载**和离线任务；下载计划最后实现。

## 2. 架构

```text
DrivePage
  │ DriveApi：账号、目录、搜索、文件操作、上传
  ▼
preload
  │ typed IPC
  ▼
main/drive
  ├─ accounts.ts      识别 115 站点连接
  ├─ detection.ts     115 登录地址判断
  ├─ 115.ts           登录检测、目录、当前目录搜索
  ├─ 115-http.ts      显式 Cookie 请求、JSON 校验
  ├─ actions.ts       新建、重命名、移动、删除
  ├─ upload.ts        115 初始化上传 + OSS 直传
  └─ mapper.ts        115 原始字段 → DriveEntry
        │
        ▼
getSiteSession(connectionId)
        │
        ▼
Electron net.request
  Cookie / 代理 / Chrome UA 全部在主进程处理
```

Cookie 值不会进入 renderer、IPC 返回值或日志。网盘页只拿到文件名、类型、大小、修改时间、视频时长等目录元数据。

关键文件：

| 文件                                            | 职责                                    |
| ----------------------------------------------- | --------------------------------------- |
| `src/shared/drive.ts`                           | 网盘账号、目录、文件操作和上传契约      |
| `src/main/drive/accounts.ts`                    | 将 115 站点连接映射为网盘账号           |
| `src/main/drive/detection.ts`                   | 识别 115 登录地址                       |
| `src/main/drive/115.ts`                         | 115 登录探针、目录列表、当前目录搜索    |
| `src/main/drive/115-http.ts`                    | 显式 Cookie 请求、JSON 响应与错误映射   |
| `src/main/drive/actions.ts`                     | 新建、重命名、移动、删除                |
| `src/main/drive/upload.ts`                      | 115 上传初始化、OSS 流式上传与进度      |
| `src/main/drive/mapper.ts`                      | 115 响应归一化、HTML 标签清理、分页状态 |
| `src/main/drive/ipc.ts`                         | 网盘 IPC 处理器                         |
| `src/renderer/pages/DrivePage.tsx`              | 网盘页交互与状态                        |
| `src/renderer/pages/DrivePage.module.css`       | 紧凑页头、搜索、列表和响应式样式        |
| `src/renderer/components/DriveActionDialog.tsx` | 新建、重命名、删除确认对话框            |
| `src/renderer/components/DriveMoveDialog.tsx`   | 目标目录选择与移动                      |
| `src/renderer/components/DriveUploadPanel.tsx`  | 上传进度面板                            |

## 3. 账号与登录

账号识别不新增配置字段，直接复用站点连接：

- 登录地址 host 必须是 `115.com` 或以 `.115.com` 结尾；
- 当前实现只取第一个 115 连接；
- 连接没有 Cookie 时显示“115 尚未登录”；
- 115 登录窗口会直接打开 `https://115.com/storage/allfiles?cid=0&mode=wangpan`，确保登录后进入网盘并写入完整账号 Cookie；
- 115 登录页会先写入游客/风控 Cookie，因此登录保存前会额外调用 `https://webapi.115.com/offine/downpath` 验证真实账号态；
- 115 的 `PHPSESSID`、`UID`、`CID`、`SEID`、`KID` 是会话 Cookie；登录校验通过后会把它们提升为 30 天持久 Cookie，再由 Chromium 加密保存到分区，不写入 `settings.json`；
- `HttpOnly` 只阻止页面 JavaScript 通过 `document.cookie` 读取，不影响主进程的 `session.cookies.get`；
- 115 请求通过主进程 `net.request` 显式构造 Cookie 请求头，避免 `session.fetch` 对 SameSite/session Cookie 的自动附加差异；
- 每次目录/搜索请求前也会调用同一个登录探针；
- 探针返回 `state: false` 且错误包含“登录”时，映射为 `auth_required`；
- 用户点击“重新登录”会打开现有站点登录窗口，成功后重新读取根目录。

登录探针使用单独的 `fetch115Json` 路径，不把“未登录”误当成普通 API 失败。

## 4. 115 接口

### 目录列表

```text
GET https://webapi.115.com/files
  ?aid=1
  &cid=<folderId>
  &offset=<offset>
  &limit=100
  &show_dir=1
  &count_folders=1
  &format=json
```

响应中的文件项归一化为：

- `cid` / `fid` → `id`
- `fc === 0` → 文件夹，`fc === 1` → 文件
- `n` / `ns` → 名称
- `s` → 文件大小
- `te` / `t` → 修改时间（渲染时显示完整年份）
- `ico` → 文件扩展名与图标类型
- `play_long` → 视频时长（秒），仅视频文件显示为 `分:秒` / `时:分:秒`
- `path` → 面包屑
- `count` + 当前页数量 → `hasMore`

文件夹排在文件前面，其余保持服务端顺序。

### 当前目录搜索

```text
GET https://webapi.115.com/files/search
  ?search_value=<query>
  &cid=<currentFolderId>
  &offset=<offset>
  &limit=100
  &count_folders=1
  &format=json
```

`cid` 固定为当前目录，因此搜索不会跨出当前文件夹。搜索结果同样归一化，搜索高亮 HTML 标签会在主进程清除。

### 文件操作

```text
POST https://webapi.115.com/files/add
  pid=<currentFolderId>&cname=<name>

POST https://webapi.115.com/files/batch_rename
  files_new_name[<fid>]=<name>
  # 文件夹额外带 fid 和 file_name

POST https://webapi.115.com/files/move
  pid=<targetFolderId>&move_proid=<timestamp_random>&fid[0]=<fid>&fid[1]=<fid>

POST https://webapi.115.com/rb/delete
  pid=<parentFolderId>&ignore_warn=1&fid[0]=<fid>&fid[1]=<fid>
```

删除支持多选：主进程按 `parentId` 分组，同一父目录的项目合并到一次 `/rb/delete` 请求。移动支持一次提交多个 `fid`，已实际验证批量移动。所有写操作都先校验连接 UUID、数字 ID、名称长度和非法字符；批处理上限 100 项。

### 上传

上传采用 115 的两段式协议：

1. `POST https://uplb.115.com/3.0/sampleinitupload.php` 获取 OSS 凭证；
2. 主进程读取本地文件，向 115 返回的 OSS host 发送 multipart 请求；
3. OSS 回调完成后文件自动注册到 `U_1_<targetFolderId>` 目录。

文件选择支持主进程原生文件对话框和文件拖拽。拖拽时 preload 通过 `webUtils.getPathForFile()` 将 `File` 解析为路径，路径不返回 renderer；主进程重新校验路径是普通文件后才复用同一上传管线。暂不支持拖拽文件夹。上传进度通过只包含文件名、字节数和状态的 IPC 事件回传。

### 错误模型

IPC 返回 `DriveResult<T>`，而不是依赖 Electron 对自定义 Error 的序列化：

```ts
type DriveResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code:
          | 'no_account'
          | 'auth_required'
          | 'invalid_input'
          | 'network'
          | 'api';
        message: string;
      };
    };
```

## 5. 页面交互

- 页头保持紧凑：115 标识、连接状态、新建文件夹、上传到当前目录、当前目录搜索框、刷新；窄窗口下两个快捷按钮只显示图标，并保留 tooltip；
- 工具栏在选中项目后显示重命名、移动、删除；
- 上传始终以当前目录为目标，不会上传到已选中的文件夹；
- 拖拽文件时显示“松开以上传到当前目录”遮罩，目标目录会明确显示；不支持拖拽文件夹；
- 上传完成后显示逐文件结果面板；全部成功时约 2.6 秒后自动消失，有失败项时保留到用户手动关闭；
- 如果上传完成时不在网盘页，成功结果面板不会开始自动消失；回到网盘页后再开始计时；
- 搜索只在当前目录内生效，结果仍显示当前面包屑，并显示搜索关键词；
- 双击文件夹进入下一层；键盘聚焦文件夹后按 Enter 也可进入；
- 单击单选；按住 Ctrl（macOS 为 Cmd）再点击可追加或取消选择；
- 多选时重命名按钮禁用；移动和删除支持批量操作；
- 删除需要二次确认；移动到目标目录时使用目录选择器；
- 加载更多按当前列表或搜索结果追加；
- 搜索无结果、空目录、登录失效、网络错误、无账号分别展示不同状态。

## 6. 安全边界

- 目录和文件操作固定访问 `https://webapi.115.com`，上传初始化固定访问 `https://uplb.115.com`；
- OSS host 来自 115 初始化响应，只允许 `http:` / `https:`，上传请求不携带 115 Cookie；
- `connectionId` 校验 UUID，`folderId` / `fid` 只接受数字字符串；
- 名称限制长度，并拒绝路径分隔符和控制字符；
- 分页大小上限 100；
- 不把 Cookie 值放入 renderer、日志或 IPC；
- 使用 `getSiteSession()` 复用分区 Cookie、代理和站点 Chrome UA；
- 115 返回的 HTML 标签在主进程清除后再传给界面；
- 本地文件路径仅由主进程文件选择器或 preload 的 `webUtils.getPathForFile()` 产生，不进入 renderer；主进程只接受绝对路径，并拒绝目录、符号链接和不可读文件。

## 7. 验证与限制

已覆盖：

- 115 站点地址识别；
- 115 响应归一化、文件夹排序、HTML 清理、分页状态；
- 界面无账号、目录列表、双击进入文件夹、当前目录搜索、登录失效状态；
- 真实 115 连接可以正确识别登录失效并显示重新登录入口；
- 登录失败时会报告缺失的账号 Cookie 名称，便于判断是登录未完成还是请求注入问题；
- 切换到其他页面再回到网盘时，不重新挂载网盘页，保留当前目录、滚动位置、选中项和搜索状态；
- 目录数据在内存中短期缓存，重新进入同一目录时优先显示缓存，超过缓存时间后再静默刷新；切回网盘页本身不会主动重新请求；
- 已实际验证新建文件夹、重命名单项、批量移动、批量删除、小文件上传、文件拖拽上传及上传后的清理；
- 上传大文件采用流式读取，但进度回调节流和断点续传尚未实现；
- 48 个 Vitest 测试全部通过，`pnpm check` 和打包构建通过。

下载尚未实现，计划放在最后处理。
