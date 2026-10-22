# 本地视频库

## 目标

在应用内选择一个或多个本地文件夹，递归扫描视频并在独立页面中展示；网格视图显示 poster，列表视图显示 thumb，点击后复用全局播放器播放。

当前不包含转码、FFmpeg 抽帧和视频编码兼容性保证。

## 分层

```text
src/main/local-video/
  scanner.ts       目录遍历、视频识别、poster/thumb 匹配
  registry.ts      视频/封面 ID 到绝对路径的短期注册表
  protocol.ts      japp-local:// 视频与封面协议，支持 Range
  ipc.ts           多文件夹选择、扫描、删除和进度事件

src/shared/local-video.ts
  本地视频库、视频项、封面、扫描进度和 LocalVideoApi 类型

src/renderer/features/local-video/
  LocalVideoProvider.tsx        多库扫描状态、播放器请求、本地进度
  LocalVideoPage.tsx            页面、网格/列表、搜索、排序、文件夹管理
  LocalVideoPage.module.css     卡片、列表、封面适配和响应式样式
  local-video-preferences.ts    视图模式和本地播放进度持久化

src/renderer/navigation.ts      导航增加“本地”
src/renderer/App.tsx            首次访问后保持页面和 Provider 挂载
```

主进程不向 renderer 返回绝对路径；renderer 只拿到视频/封面的 opaque ID 和 `japp-local://` URL。

## 多文件夹

- 设置页不增加独立入口；本地页直接选择文件夹。
- 文件夹选择使用 `properties: ['openDirectory', 'multiSelections']`，一次可以选择多个。
- 已选目录保存在 settings 的 `localVideo.directories`，最多 50 个。
- 页面顶部显示文件夹 chips，每个 chip 显示文件夹名和视频数量，右侧 `×` 可删除。
- 删除文件夹只更新 settings 和当前库，不重新扫描其他文件夹；操作前显示二次确认，不会删除磁盘文件。
- 扫描失败文件夹的错误提示中也可通过二次确认移除该配置。
- 新增或重新扫描会对全部已保存文件夹顺序扫描。
- 单个文件夹扫描失败会记录在 `errors`，不影响其他文件夹；错误提示中可直接移除失效文件夹。
- 旧版本的单目录 `localVideo.directory` 会在 Zod 解析时迁移为 `directories`。

## 扫描规则

- 默认递归子目录，最大深度 20。
- 单个文件夹最多扫描 20000 个条目；超过后标记 `truncated`。
- 跳过隐藏目录/文件、符号链接、`System Volume Information`、`$RECYCLE.BIN`、`@eaDir`、`.git` 和 `node_modules`。
- 视频扩展名：`mp4`、`m4v`、`webm`、`mov`、`mkv`、`avi`、`ts`、`m2ts`、`flv`、`wmv`、`mpg`、`mpeg`。
- 图片只接受 `poster` 和 `thumb` 两种文件名后缀，支持 `-poster`、`.poster`、`_poster`、`-thumb`、`.thumb`、`_thumb`。
- 视频 ID 和封面 ID 使用绝对路径哈希，重复扫描同一文件夹时保持稳定。
- 上次选择的目录写入 settings，下次打开“本地”页时自动恢复扫描。

## 封面匹配

对 `STARS-250-C.mp4`：

- `STARS-250-C-poster.jpg` / `.poster.jpg` / `_poster.jpg` → `poster`
- `STARS-250-C-thumb.jpg` / `.thumb.jpg` / `_thumb.jpg` → `thumb`

不匹配同名普通图片、公共 `poster.jpg`、`cover` 或其他图片。

常见尺寸：

- poster：`379 × 535`（约 0.708:1）
- thumb：`800 × 535`（约 1.495:1）

### 网格与列表

- **网格视图**：使用 poster，媒体区固定 `379 / 535` 比例，图片 `object-fit: cover`，卡片呈竖版海报。
- **列表视图**：使用 thumb，媒体区固定 `800 / 535` 比例，图片 `object-fit: cover`，横向缩略图卡片多列排列，不再一行一个视频。
- 缺少目标类型时回退到另一种封面；两种都没有时显示占位。
- 封面加载失败会自动尝试另一种封面，再失败则显示占位。
- 卡片不显示文件类型角标；播放按钮在鼠标移入卡片或键盘聚焦时显示。
- 视图模式保存在 `japp.local-view.v1`，默认网格。

## 自定义协议

```text
japp-local://video/<libraryId>/<videoId>
japp-local://poster/<libraryId>/<posterId>
```

`protocol.handle` 只接受注册表内且位于当前库根目录内的路径。

- 视频支持 `Range`、`206 Partial Content` 和 `Accept-Ranges`，保证本地视频可以 seek。
- 视频不缓存整段；封面允许短时间缓存。
- 根据扩展名返回 MIME。
- CSP 的 `media-src`、`img-src` 增加 `japp-local:`。
- 不把 `file://` 路径直接暴露给 renderer。

## 播放器

`VideoPlayerSource` 新增：

```ts
kind?: 'hls' | 'file';
posterUrl?: string;
```

- 115 播放继续使用 `kind: 'hls'`（缺省）。
- 本地视频使用 `kind: 'file'`，播放器直接设置 `video.src`、`load()` 和 `play()`，不经过 hls.js。
- 当前选中的 poster 作为 `video.poster`。
- 工具栏、音量、倍速、全屏、最小化和全局悬浮条全部复用。
- 本地 provider 把全部文件夹的视频作为播放列表，播放结束自动进入下一个视频。
- 本地进度保存在 `japp.local-progress.v1:<videoId>`，再次打开时从上次位置继续。

## 页面布局

- 头部与网盘页一致：紧凑 eyebrow、`1.7–2.05rem` 标题、单行说明、右侧操作按钮。
- 顶部文件夹 chips + 扫描状态。
- LIBRARY 工具栏包含文件夹数量、扫描时间、搜索、排序和网格/列表切换。
- 页脚使用 fluid page slot，排在卡片列表之后，不再覆盖内容。
- 响应式：1180px 宽度为 5 列网格，900px 为 4 列，窄屏为 2 列；列表视图使用横向卡片网格，1180px 约 4 列、900px 约 3 列。

## 本地字幕

播放本地视频前，主进程会按 115 播放相同的 `matchSubtitleNames` 规则匹配字幕：

- 来源优先使用设置里的字幕目录，再回退到视频所在目录。
- 支持 `srt`、`vtt`、`ass`、`ssa`。
- 使用和 115 一致的归一化、目录编号、集数编号和前缀评分规则。
- 因此 `ADN-503-C.mp4` 可以匹配 `ADN-503.srt`，也支持 `STARS-250-C.zh-CN.srt`、`STARS-250-C-en.srt`、`STARS-250-C_en.vtt`。
- 最多 10 条、单文件最大 2 MB；同名字幕优先使用设置目录中的文件。
- 自动识别 UTF-8 BOM、UTF-16LE、UTF-16BE；UTF-8 解码失败时回退到 GB18030。
- `getSubtitles` 只读取注册表中的视频路径、视频同目录和设置字幕目录，不向 renderer 暴露绝对路径。
- 播放器打开前读取字幕，作为 `subtitleTracks` 挂载；字幕工具栏可切换轨道、开关字幕和调整延迟。
- 字幕读取失败不会阻止视频播放。

## 限制

- Chromium 能解码的格式才可播放；MKV/HEVC/AVI 等可能触发“编码不受支持”错误。
- 不生成视频缩略图；无 poster/thumb 时显示占位。
- 文件夹数量较大时使用 `content-visibility` 和图片懒加载，暂未实现虚拟列表。
- 不监控文件夹变化，需要手动重新扫描。
- 字幕只读取设置字幕目录和视频同目录，不递归扫描字幕子目录。

## 验证

- 主进程扫描测试覆盖嵌套目录、视频识别、poster/thumb 优先级、隐藏目录和稳定 ID。
- 字幕测试覆盖 115 同款模糊匹配、`ADN-503` 短名、设置字幕目录、UTF-16LE、GB18030 回退和其他视频字幕隔离。
- 设置测试覆盖旧单目录到 `directories` 的迁移。
- 页面测试覆盖多文件夹删除二次确认、网格/列表切换、不同封面、字幕挂载和本地 `file` source 播放。
- 真实本地视频验证：
  - 两个文件夹、8 个视频；
  - 网格使用 379×535 poster，列表使用 800×535 thumb；
  - 切换视图时封面变化，卡片不变形；
  - 播放后 `readyState=4`、seek 正常；
  - 最小化后切换到设置页，悬浮条仍在，恢复后仍是同一个 `<video>`。
- 当前总测试数 108，`pnpm check` 和 `pnpm package` 通过。
