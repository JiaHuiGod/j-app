# 115 网盘只读浏览

## 1. 功能目标

网盘页复用设置中已经保存的 115 站点连接，展示 115 网盘目录，不读取或返回 Cookie 值。

当前范围：

- 自动识别登录地址属于 `115.com` / `*.115.com` 的站点连接；
- 只使用一个 115 账号；
- 浏览根目录和文件夹；
- 当前目录内搜索；
- 面包屑返回上级、刷新、分页加载更多；
- 双击文件夹进入下一层；
- 未登录、登录失效、无账号、空目录、网络错误均有独立状态；
- 登录失效时可以直接打开现有登录窗口重新登录。

当前范围**不包含**上传、下载、重命名、移动、删除、离线任务。

## 2. 架构

```text
DrivePage
  │ DriveApi：账号、目录、搜索结果
  ▼
preload
  │ typed IPC
  ▼
main/drive
  ├─ accounts.ts      识别 115 站点连接
  ├─ detection.ts     115 登录地址判断
  ├─ 115.ts           登录检测、目录、当前目录搜索
  └─ mapper.ts        115 原始字段 → DriveEntry
        │
        ▼
getSiteSession(connectionId)
        │
        ▼
Electron Session.fetch
  Cookie / 代理 / Chrome UA 全部在主进程处理
```

Cookie 值不会进入 renderer、IPC 返回值或日志。网盘页只拿到文件名、类型、大小、修改时间等目录元数据。

关键文件：

| 文件                                      | 职责                                    |
| ----------------------------------------- | --------------------------------------- |
| `src/shared/drive.ts`                     | 网盘账号、目录、搜索和错误契约          |
| `src/main/drive/accounts.ts`              | 将 115 站点连接映射为网盘账号           |
| `src/main/drive/detection.ts`             | 识别 115 登录地址                       |
| `src/main/drive/115.ts`                   | 115 登录探针、目录列表、当前目录搜索    |
| `src/main/drive/mapper.ts`                | 115 响应归一化、HTML 标签清理、分页状态 |
| `src/main/drive/ipc.ts`                   | 网盘 IPC 处理器                         |
| `src/renderer/pages/DrivePage.tsx`        | 网盘页交互与状态                        |
| `src/renderer/pages/DrivePage.module.css` | 紧凑页头、搜索、列表和响应式样式        |

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

- 页头保持紧凑：115 标识、连接状态、只读标识、当前目录搜索框、刷新；
- 搜索只在当前目录内生效，结果仍显示当前面包屑，并显示搜索关键词；
- 双击文件夹进入下一层；键盘聚焦文件夹后按 Enter 也可进入；
- 单击选中文件/文件夹，用于后续扩展；
- 底部提示“双击文件夹进入下一层”；
- 加载更多按当前列表或搜索结果追加；
- 搜索无结果、空目录、登录失效、网络错误、无账号分别展示不同状态。

## 6. 安全边界

- 只访问固定的 `https://webapi.115.com`；
- `connectionId` 校验 UUID，`folderId` 只接受数字字符串；
- 分页大小上限 100；
- 不把 Cookie 值放入 renderer、日志或 IPC；
- 使用 `getSiteSession()` 复用分区 Cookie、代理和站点 Chrome UA；
- 115 返回的 HTML 标签在主进程清除后再传给界面；
- 只读实现不调用上传、移动、删除、重命名接口。

## 7. 验证与限制

已覆盖：

- 115 站点地址识别；
- 115 响应归一化、文件夹排序、HTML 清理、分页状态；
- 界面无账号、目录列表、双击进入文件夹、当前目录搜索、登录失效状态；
- 真实 115 连接可以正确识别登录失效并显示重新登录入口；
- 登录失败时会报告缺失的账号 Cookie 名称，便于判断是登录未完成还是请求注入问题；
- 切换到其他页面再回到网盘时，不重新挂载网盘页，保留当前目录、滚动位置、选中项和搜索状态；
- 目录数据在内存中短期缓存，重新进入同一目录时优先显示缓存，超过缓存时间后再静默刷新；切回网盘页本身不会主动重新请求；
- 39 个 Vitest 测试全部通过，`pnpm check` 和打包构建通过。

真实目录数据需要在 115 登录态有效时验证；当前没有上传/下载等写操作。
