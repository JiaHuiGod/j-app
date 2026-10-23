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
- 离线任务：提交 magnet / ED2K / HTTP / FTP 链接到当前目录，查看本次提交的任务和进度；
- 文件下载：选中任意文件后获取 115 下载地址，通过系统保存对话框下载到本地，并显示进度；视频仍优先走视频接口，其他文件走通用文件下载接口；默认目录在设置页配置；
- 视频播放：使用接口返回的 `video_url`（m3u8），通过主进程本机代理和 hls.js 在线播放；按文件记忆播放进度，支持续播和当前目录视频自动连播；
- 字幕：从设置页配置的本地字幕目录读取 SRT、VTT、ASS、SSA，按文件名和番号自动匹配；支持开关、切换和延迟调整；
- 未登录、登录失效、无账号、空目录、网络错误均有独立状态；
- 登录失效时可以直接打开现有登录窗口重新登录；从设置页完成登录或更新 Cookie 后，返回网盘页会自动重新检测会话；

视频接口同时返回 `origin_file_url` 和 `video_url`；前者用于下载，后者用于 hls.js 播放，下载和播放使用独立的会话与 Cookie 处理。

## 2. 架构

```text
DrivePage
  │ DriveApi：账号、目录、搜索、文件操作、上传、离线任务、文件下载与播放
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
  ├─ offline.ts       离线任务列表、提交与凭证
  ├─ download.ts      文件/视频地址获取与流式下载
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

| 文件                                                                 | 职责                                     |
| -------------------------------------------------------------------- | ---------------------------------------- |
| `src/shared/drive.ts`                                                | 网盘账号、目录、文件操作和上传契约       |
| `src/main/drive/accounts.ts`                                         | 将 115 站点连接映射为网盘账号            |
| `src/main/drive/detection.ts`                                        | 识别 115 登录地址                        |
| `src/main/drive/115.ts`                                              | 115 登录探针、目录列表、当前目录搜索     |
| `src/main/drive/115-http.ts`                                         | 显式 Cookie 请求、JSON 响应与错误映射    |
| `src/main/drive/actions.ts`                                          | 新建、重命名、移动、删除                 |
| `src/main/drive/offline.ts`                                          | 离线任务签名、提交和任务列表             |
| `src/main/drive/offline-mapper.ts`                                   | 离线任务状态、进度和分页归一化           |
| `src/main/drive/download.ts`                                         | 文件/视频直链、保存对话框和流式下载      |
| `src/main/drive/playback.ts`                                         | 播放会话、本机代理与 m3u8 重写           |
| `src/main/drive/subtitles.ts`                                        | 本地字幕目录读取与内容解码               |
| `src/main/drive/subtitle-matcher.ts`                                 | 视频与字幕文件名匹配                     |
| `src/main/drive/upload.ts`                                           | 115 上传初始化、OSS 流式上传与进度       |
| `src/main/drive/mapper.ts`                                           | 115 响应归一化、HTML 标签清理、分页状态  |
| `src/main/drive/ipc.ts`                                              | 网盘 IPC 处理器                          |
| `src/renderer/pages/DrivePage.tsx`                                   | 网盘页交互与状态                         |
| `src/renderer/pages/DrivePage.module.css`                            | 紧凑页头、搜索、列表和响应式样式         |
| `src/renderer/playback/GlobalVideoPlayerProvider.tsx`                | 通用播放宿主、最小化悬浮按钮与跨页面恢复 |
| `src/renderer/features/drive/playback/DrivePlaybackProvider.tsx`     | 115 播放数据接入与全局播放错误提示       |
| `src/renderer/features/drive/playback/useDrivePlayback.ts`           | 115 播放适配：会话、竞态、进度和连播     |
| `src/renderer/components/video-player/`                              | 通用 HLS 播放器、工具栏、播放列表抽屉    |
| `src/renderer/components/video-player/VideoPlayerToolbar.tsx`        | 播放、进度、音量、倍速、字幕和全屏控件   |
| `src/renderer/components/video-player/useVideoMediaState.ts`         | 媒体状态同步与播放控制                   |
| `src/renderer/lib/player-preferences.ts`                             | 音量/静音记忆和会话级倍速                |
| `src/renderer/features/drive/lib/drive-playlist.ts`                  | 当前目录视频过滤、自然排序与短标题       |
| `src/renderer/lib/file-kind.ts`                                      | 扩展名到文件类型的统一映射               |
| `src/renderer/features/drive/components/DriveActionDialog.tsx`       | 新建、重命名、删除确认对话框             |
| `src/renderer/features/drive/components/DriveMoveDialog.tsx`         | 目标目录选择与移动                       |
| `src/renderer/features/drive/components/DriveFolderPickerDialog.tsx` | 离线任务保存目录选择                     |
| `src/renderer/features/drive/components/DriveUploadPanel.tsx`        | 上传进度面板                             |
| `src/renderer/features/drive/components/DriveOfflineDialog.tsx`      | 离线任务提交与列表                       |
| `src/renderer/features/drive/components/DriveDownloadPanel.tsx`      | 视频下载进度与结果                       |
| `src/renderer/lib/playback-progress.ts`                              | 按文件和站点保存播放进度                 |
| `src/renderer/lib/subtitles.ts`                                      | SRT、VTT、ASS、SSA 解析                  |
| `src/renderer/components/DownloadSettings.tsx`                       | 设置页下载和字幕目录                     |

### 视频播放分层

播放器拆成通用组件、通用宿主和 115 适配层：

- `video-player/VideoPlayerDialog` 只接收 `source`、`title`、`playlist`、`activeId`、`subtitleTracks`、`resumePosition`、`isLoading`、`error` 和回调；HLS、自定义工具栏、字幕菜单、续播提示、可折叠抽屉与响应式都留在这一层，不访问 `window.desktop`，也不导入 `@shared/drive`。
- `playback/GlobalVideoPlayerProvider` 在 `App` 根部常驻，管理单个播放器请求、最小化状态、悬浮条、播放/暂停、恢复和关闭；任何模块都可通过 `useGlobalVideoPlayer().showPlayer(request)` 使用这套能力，卸载模块页面不会卸载播放器。
- `features/drive/playback/DrivePlaybackProvider` 不再渲染播放器或悬浮条，只负责把 `useDrivePlayback` 的播放状态同步到全局宿主，并保留 115 播放错误提示。
- `useDrivePlayback` 负责 `startPlayback` / `stopPlayback`、本地字幕读取、播放进度读写、当前目录视频排序、原地切换、自动连播和错误文案映射。
- 每次播放请求携带递增序号；过期请求成功时只停止它自己的会话，不覆盖当前视频；新会话成功后才停止旧会话；切换失败时保留当前播放器。
- 关闭播放器会立即停止当前会话并使所有在途请求失效；在途请求随后返回的会话会被回收。
- 暂停、播放结束、切换和关闭都由通用播放器先上报进度，再由适配层按当前文件写入 localStorage；媒体元数据就绪前不上报，避免把旧视频的进度记到新视频上。
- 音量、静音写入 localStorage，切换视频和应用重启后保留；播放速度只保存在本次渲染进程会话中，切换视频不重置，重启应用恢复 `1x`。

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

### 文件与视频下载

视频下载：

```text
GET https://webapi.115.com/files/video?pickcode=<pc>
```

- 目录列表归一化时保留 115 的 `pc` 字段为 `pickcode`，`d` 字段为 `downloadKey`；
- 选中单个视频文件后显示“下载”，主进程用 `pickcode` 获取地址；
- 接口返回的 `origin_file_url` 用于下载，`video_url`（m3u8）用于在线播放；
- 视频接口会通过 `Set-Cookie` 返回一个**一次性的下载校验 Cookie**；主进程解析该响应头，与站点 Cookie 合并后仅用于本次下载请求；
- 该下载校验 Cookie 不写入持久缓存，使用后从站点分区 session 清理；每次获取视频地址都会拿到新值；
- 主进程先弹出系统保存对话框，默认位置取设置页配置的下载目录；用户仍可在对话框中临时选择其他目录；
- 再把 CDN 响应流式写入 `.japp-part`，完成后重命名为目标文件并回传进度与实时速度；
- 下载过程中可取消；取消或失败会中止请求、等待文件句柄关闭并删除 `.japp-part`；成功后只剩最终文件；
- 下载完成记录保存在主进程内，按下载 ID 打开文件所在目录，不接受 renderer 传入任意路径；
- 下载请求只向 115 域携带站点 Cookie，不把下载地址或 Cookie 返回 renderer；
- 目标路径只由主进程保存对话框产生。

非视频文件下载：

```text
GET https://webapi.115.com/files/download?dl=<d>&pickcode=<pc>&_=<timestamp>
```

- 选中任意非视频文件且同时具有 `pickcode`、`downloadKey` 时显示“下载”；
- 第一步接口可能直接返回 `file_url`，此时直接使用；也可能返回 `file_url_302`，再从中提取 `t` 请求 `https://dl.115cdn.net/files/dl302` 获取最终地址；
- 两步接口都可能返回 `Set-Cookie`，主进程只在本次下载请求中合并使用，不持久化；
- 非视频文件使用“保存文件”对话框和“所有文件”过滤器，视频文件仍保留视频过滤器；
- 115 对部分大文件会在第一步直接返回大小限制错误，此时把错误显示在下载面板，不创建 `.japp-part`；
- 文件下载与视频下载共用流式写入、进度、速度、取消和打开目录逻辑。

### 视频播放

```text
GET https://webapi.115.com/files/video?pickcode=<pc>
```

- 选中视频后点击“播放”或双击视频文件，renderer 调用 `startPlayback`；
- 主进程获取 `video_url`，建立播放会话和仅监听 `127.0.0.1` 的 HTTP 代理；
- renderer 只拿到本地代理地址，用 hls.js 播放；
- 主进程代理 m3u8、子播放列表、分片和加密密钥，并重写其中的 URI；
- 播放请求携带站点 Cookie、一次性 Set-Cookie、`Referer: https://115.com/` 和站点 UA；
- 提供 Range 透传和 CORS，响应不暴露真实 115 地址；
- 关闭播放器时停止会话、中止未完成请求并释放资源映射；
- 播放地址过期或加载失败时，可以重新获取地址；
- 播放进度按“站点连接 + 文件 ID”保存在 renderer 的 localStorage 中，播放中每 4 秒、暂停、关闭和切换视频时写入；
- 再次打开同一视频时自动跳转并显示“继续观看”，可一键从头播放；接近结尾或刚开始播放的进度不保存；
- 当前目录中的视频按文件名自然排序，播放器右侧显示默认折叠的半透明抽屉式播放列表和当前项；抽屉覆盖在视频上，展开/收起不改变播放器尺寸；激活项只滚动播放列表自身，不会带动弹窗横向移动；点击列表项直接切换；播放结束后自动播放下一集；
- 播放器使用自定义工具栏替代原生 controls：播放/暂停、进度、时间、音量/静音、倍速、字幕和全屏；播放中鼠标静止 2.5 秒后工具栏淡出，暂停、悬停、聚焦、拖动进度或打开菜单时保持显示；
- 快捷键：`Space`/`K` 播放暂停，`←`/`→` 前后 5 秒，`↑`/`↓` 调整音量，`M` 静音，`F` 全屏，`C` 字幕开关；拖到视频画面单击播放暂停，双击全屏；
- 音量与静音全局记忆，切换视频后保留；倍速在本次应用会话内保留，切换视频不重置，重启恢复 `1x`；
- 播放器可最小化到右下角悬浮按钮；最小化后视频继续播放，切换到其他页面后悬浮按钮仍可见，点击可恢复原弹窗和播放位置，也可直接从悬浮按钮关闭播放；
- 悬浮按钮左侧提供播放/暂停控制，图标随视频状态同步；悬停时整个悬浮条上浮并轻微放大，内部按钮不再单独改变背景；
- 悬浮按钮显示精简文件名并限制最大宽度，长文件名会省略；播放器打开和最小化使用类似 macOS 窗口的缩放、下坠和模糊过渡，并尊重 `prefers-reduced-motion`；
- 字幕使用设置页配置的本地字幕目录，读取 SRT、VTT、ASS、SSA；按文件名、番号/集数、语言后缀匹配，只加载匹配项；
- 字幕控制在工具栏“字幕”菜单内：开关、候选切换、±0.5 秒延迟和重置延迟；无匹配时显示“未匹配到本地字幕”；
- 115 视频接口未提供可直接挂载的 WebVTT 字幕轨道，因此当前字幕来源为本地目录，不向 renderer 传入任意文件路径。

### 离线任务

```text
GET https://115.com/web/lixian/?ct=lixian&ac=task_lists&page=1

GET https://115.com/?ct=offline&ac=space&_=<timestamp>
GET https://webapi.115.com/offine/downpath

POST https://115.com/web/lixian/?ct=lixian&ac=add_task_url
POST https://115.com/web/lixian/?ct=lixian&ac=add_task_urls
  savepath=&wp_path_id=<folderId>&url=<url>&uid=<uid>&sign=<sign>&time=<time>
```

- 单条链接使用 `add_task_url` 和 `url` 字段；
- 多条链接使用 `add_task_urls` 和 `url[0]`、`url[1]` 等字段；
- 提交前并行获取离线空间凭证 `sign/time` 和用户 `uid`；
- 后端读取最近一页任务用于匹配本次提交结果；界面只显示本次弹窗提交过的链接对应任务，不展示账号历史任务；
- 打开离线任务面板时每 4 秒自动刷新；有任务提交后关闭弹窗，会清空目录缓存并强制刷新当前目录。

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

解析 115 的 `state: false` 响应时，会依次读取 `error`、`error_msg`、`errmsg`、`message`、`msg`，把服务端文案直接作为 `DriveError.message` 返回；没有文案时才回退到错误码或通用提示。批量提交时，`result` 数组里的每一条错误都会带上自己的 `url` 和 `error_msg`，界面按链接逐条展示，不会只显示第一条。

## 5. 页面交互

- 页头保持紧凑：115 标识、连接状态、新建文件夹、上传、离线任务、当前目录搜索框、刷新；窄窗口下三个快捷按钮只显示图标，并保留 tooltip；
- 工具栏在选中项目后显示重命名、移动、删除；
- 上传始终以当前目录为目标，不会上传到已选中的文件夹；
- 拖拽文件时显示“松开以上传到当前目录”遮罩，目标目录会明确显示；不支持拖拽文件夹；
- 上传完成后显示逐文件结果面板；全部成功时约 2.6 秒后自动消失，有失败项时保留到用户手动关闭；
- 如果上传完成时不在网盘页，成功结果面板不会开始自动消失；回到网盘页后再开始计时；
- 离线任务弹窗支持多链接提交，可通过目录选择器更改保存目录；任务列表只显示本次提交的链接对应的状态、进度和速率；
- 选中单个文件时显示“下载”；视频文件额外显示“播放”，也可双击视频文件直接播放；非视频文件需要同时具备 `pickcode` 和 `downloadKey`；
- 选择保存位置后显示下载进度和实时下载速度，可随时取消；下载完成后可点击“打开下载目录”；视频与普通文件共用同一进度面板；
- 播放器提供自定义工具栏（播放、进度、音量、倍速、字幕、全屏），最小化后右下角显示可播放/暂停、恢复或直接关闭的悬浮按钮，悬停有整体上浮动画；
- 已有播放进度时，选中项会显示“继续观看 mm:ss”，打开播放器自动续播并显示继续观看提示；
- 播放器右侧显示默认折叠的半透明抽屉式播放列表；字幕开关、选择和延迟调整位于底部工具栏的字幕菜单内；播放结束自动进入下一集；
- 选择保存位置后显示下载进度和实时下载速度，可随时取消；下载完成后可点击“打开下载目录”；
- 设置页可以配置默认下载目录和本地字幕目录；网盘页在选中视频时显示当前默认目录，保存对话框仍可临时更改；
- 加载目录或搜索时显示与真实列表相同列模板的骨架，并保留“名称 / 大小 / 修改时间”表头，数据返回后不会发生列错位；
- 搜索只在当前目录内生效，结果仍显示当前面包屑，并显示搜索关键词；
- 双击文件夹进入下一层；键盘聚焦文件夹后按 Enter 也可进入；
- 单击单选；按住 Ctrl（macOS 为 Cmd）再点击可追加或取消选择；
- 多选时重命名按钮禁用；移动和删除支持批量操作；
- 删除需要二次确认；移动到目标目录时使用目录选择器；
- 加载更多按当前列表或搜索结果追加；
- 搜索无结果、空目录、登录失效、网络错误、无账号分别展示不同状态。

## 6. 安全边界

- 目录和文件操作固定访问 `https://webapi.115.com`，上传初始化固定访问 `https://uplb.115.com`；
- 离线任务固定访问 `https://115.com` 和 `https://webapi.115.com/offine/downpath`；
- 离线链接只接受 `magnet:`、`ed2k:`、`http:`、`https:`、`ftp:`，长度上限 4096，单次最多 20 条；
- 视频播放代理只绑定 `127.0.0.1`，使用随机端口和不可猜测的播放会话 ID；
- renderer 只获得本地代理地址，不获得真实 115 m3u8/分片地址；
- 代理只允许访问当前会话已登记的资源，不接受任意上游 URL；
- 播放 Cookie 只在当前播放会话内使用，不持久化；
- 下载只接受列表中的 `pickcode` 和 `downloadKey` 格式，下载地址仅允许 `http:` / `https:`；
- 下载目标路径只来自系统保存对话框，不接受 renderer 传入的本地路径；
- 本地字幕只读取设置页配置的目录，按视频 basename 匹配；不接受 renderer 传入的目录或文件路径，单文件上限 2 MB；
- 字幕内容只返回给当前播放器，不写入日志；
- 文件/视频下载使用站点分区 session；接口返回的一次性下载 Cookie 只合并到本次下载请求，不持久化；
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
- 目录数据在内存中短期缓存，重新进入同一目录时优先显示缓存；但账号未连接、待登录或登录失效时，切回网盘页会清空目录缓存并重新检测 115 账号和根目录；
- 已实际验证新建文件夹、重命名单项、批量移动、批量删除、小文件上传、文件拖拽上传及上传后的清理；
- 已实际读取真实 115 账号的离线任务列表并验证保存目录选择；本次任务过滤和关闭后目录刷新有界面测试覆盖；
- 已实际提交无效的离线单条和多条链接，验证单条显示“错误的链接”，多条会按链接分别返回错误；界面测试覆盖不同链接对应不同错误文案；
- 已实际调用真实视频地址接口，确认同时返回 `origin_file_url`、`video_url` 和一次性 `Set-Cookie`；
- 已实际发起真实视频下载，确认加入接口 Set-Cookie 后 CDN 返回正常并开始写入；面板显示实时速度，取消后确认 `.japp-part` 已删除；
- 已实际下载真实 115 普通文件：字幕文件第一步直接返回 `file_url`，完成流式写入后得到 36215 字节、内容正确的 `IPZ-771.srt`；下载进度、完成状态和打开目录入口正常；大文件会由 115 返回大小限制错误；
- 已实际播放真实 115 视频，浏览器媒体状态达到可播放（`readyState=4`），时长和播放进度正常；
- 重构后使用临时用户目录副本再次实际验证：真实 115 视频可播放，字幕轨道可加载/开关并渲染字幕，关闭后重新打开会续播，播放列表切换时弹窗和 `<video>` 元素保持不变；验证未修改真实 `settings.json`、Cookie 或字幕目录；
- 自定义工具栏实际验证：播放、暂停、静音、1.5x 倍速、字幕菜单、全屏进入/退出正常；播放中鼠标静止后工具栏隐藏，移动后恢复显示；
- 最小化实际验证：最小化后弹窗关闭但 `<video>` 保持同一个 DOM 节点并继续播放（2 秒内进度前进约 2 秒）；切换到设置页后悬浮按钮仍可见，点击恢复同一视频、播放位置、音量和倍速；
- 通用宿主实际验证：播放器和悬浮条位于 `app-window` 之外的全局 Provider，从网盘页切换到设置页后仍保留；恢复的是同一个 `<video>`，悬浮条播放/暂停和关闭均有效；另有不依赖 115 的通用宿主组件测试；
- 动画实际验证：打开/恢复弹窗检测到 320ms 缩放淡入，最小化检测到 280ms 缩放下坠；动画结束或 360ms 兜底后弹窗关闭并出现悬浮按钮；
- 悬浮窗实际验证：长文件名会显示精简名称并省略，实测宽度约 140px；左侧图标可在不恢复弹窗的情况下暂停/继续视频，图标同步切换；悬停时整体上浮到 `translateY(-2px) scale(1.015)`，内部按钮背景保持透明；右侧关闭按钮可直接结束播放并移除弹窗和悬浮按钮；
- 播放列表滚动条实测为 `thin` 低对比度样式，悬停时才提高可见度；
- 播放器打开和关闭有界面测试覆盖，关闭时调用停止播放会话接口；
- 字幕文件名匹配、SRT/ASS 解析、播放进度保存与格式化为单元测试覆盖；
- 续播入口、字幕选择/开关和原地切换有界面测试覆盖；抽屉开关、工具栏控制、自动隐藏、最小化跨页面恢复、通用播放器错误恢复、切换竞态、关闭清理和自动连播有组件/适配层测试覆盖；
- 下载按钮、保存目录结果、进度面板、取消操作和打开目录有界面测试覆盖；
- 已定位 CDN 403 的原因：下载请求缺少视频接口返回的一次性 Set-Cookie；同时改用 115 站点分区 session；
- 上传大文件采用流式读取，但进度回调节流和断点续传尚未实现；
- 离线任务暂不支持暂停、继续或删除任务，仅支持提交和查看本次任务；
- 视频下载支持取消，但不支持暂停或继续；
- 播放暂不支持手动清晰度和字幕时间轴微调以外的字幕样式设置；自动连播基于当前已加载的当前目录视频；
- 115 视频接口未提供可直接挂载的字幕轨道，当前字幕来源为本地目录；
- 135 个 Vitest 测试全部通过，`pnpm check` 和打包构建通过。
