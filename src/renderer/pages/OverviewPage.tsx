import { useAppInfo } from '../hooks/useAppInfo';
import page from '../styles/page.module.css';
import styles from './OverviewPage.module.css';

const architectureLayers = [
  {
    name: 'Main',
    path: 'src/main/index.ts',
    description: '窗口生命周期、IPC 与系统能力。',
  },
  {
    name: 'Preload',
    path: 'src/preload/index.ts',
    description: '用 contextBridge 收窄通信边界。',
  },
  {
    name: 'Renderer',
    path: 'src/renderer/main.tsx',
    description: 'React 界面，不直接接触 Node.js。',
  },
] as const;

const platformNames: Record<string, string> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
};

function formatPlatform(platform: string): string {
  return platformNames[platform] ?? platform;
}

export function OverviewPage() {
  const { state, retry } = useAppInfo();

  return (
    <main className={page.content}>
      <section className={page.intro} aria-labelledby="intro-title">
        <p className={page.eyebrow}>Electron / React / TypeScript</p>
        <h1 id="intro-title">
          从清晰的边界开始，
          <br />
          构建<span className={page.highlight}>可靠的</span>桌面应用。
        </h1>
        <p className={page.lede}>
          主进程掌握系统权限，预加载层收窄通信边界，渲染进程专注界面。
          这是一个已经搭好安全骨架、可以直接开始写业务的起点。
        </p>

        <div className={page.stack} aria-label="技术栈">
          <span>Electron 44</span>
          <span>React 19</span>
          <span>TypeScript</span>
          <span>Vite 8</span>
        </div>

        <ol className={styles.layers} aria-label="进程架构">
          {architectureLayers.map((layer, index) => (
            <li className={styles.layer} key={layer.name}>
              <div className={styles.layerHeading}>
                <span className={styles.layerIndex}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={styles.layerName}>{layer.name}</span>
              </div>
              <code>{layer.path}</code>
              <p>{layer.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <aside className={styles.runtimeCard} aria-labelledby="runtime-title">
        <div className={styles.runtimeTop}>
          <span className={styles.runtimeKicker}>Runtime</span>
          <span className={styles.runtimeLive}>
            <span aria-hidden="true" />
            Live
          </span>
        </div>

        <h2 id="runtime-title">运行环境</h2>
        <p className={styles.runtimeSubtitle}>
          由主进程通过类型安全的 IPC 返回
        </p>

        {state.status === 'loading' && (
          <div className={styles.runtimeLoading}>
            <div aria-hidden="true" className={styles.skeletonList}>
              {Array.from({ length: 4 }, (_, index) => (
                <span className={styles.skeletonRow} key={index}>
                  <span className={styles.skeletonLabel} />
                  <span className={styles.skeletonValue} />
                </span>
              ))}
            </div>
            <span className="sr-only">正在读取运行环境</span>
          </div>
        )}

        {state.status === 'error' && (
          <div className={styles.runtimeError} role="alert">
            <strong>未能读取运行环境</strong>
            <p>{state.message}</p>
            <button
              className={styles.retryButton}
              type="button"
              onClick={retry}
            >
              重新连接
            </button>
          </div>
        )}

        {state.status === 'success' && (
          <div>
            <dl className={styles.runtimeList}>
              <div>
                <dt>应用版本</dt>
                <dd>{state.data.appVersion}</dd>
              </div>
              <div>
                <dt>Electron</dt>
                <dd>{state.data.electronVersion}</dd>
              </div>
              <div>
                <dt>Chromium</dt>
                <dd>{state.data.chromeVersion}</dd>
              </div>
              <div>
                <dt>Node.js</dt>
                <dd>{state.data.nodeVersion}</dd>
              </div>
              <div>
                <dt>系统</dt>
                <dd>
                  {formatPlatform(state.data.platform)} / {state.data.arch}
                </dd>
              </div>
            </dl>

            <div className={styles.bridge}>
              <span className={styles.bridgeIcon} aria-hidden="true">
                ✓
              </span>
              <div className={styles.bridgeCopy}>
                <strong>Preload bridge 已连接</strong>
                <span>window.desktop.getAppInfo()</span>
              </div>
            </div>

            <p className={styles.runtimeMode}>
              {state.data.isPackaged ? '生产构建' : '开发模式'}
            </p>
          </div>
        )}
      </aside>
    </main>
  );
}
