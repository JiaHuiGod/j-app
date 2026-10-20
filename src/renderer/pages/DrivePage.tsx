import page from '../styles/page.module.css';
import styles from './DrivePage.module.css';

function CloudIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.4"
      viewBox="0 0 24 24"
    >
      <path d="M7.7 18.5h8.8a4.1 4.1 0 0 0 .5-8.16A5.7 5.7 0 0 0 6.1 9.1a4.75 4.75 0 0 0 1.6 9.4Z" />
      <path d="M12 9.8v5.7M9.7 13.2 12 15.5l2.3-2.3" />
    </svg>
  );
}

export function DrivePage() {
  return (
    <main className={page.content}>
      <section className={page.intro} aria-labelledby="drive-page-title">
        <p className={page.eyebrow}>Cloud Drive / 即将上线</p>
        <h1 id="drive-page-title">
          把文件，放在
          <br />
          <span className={page.highlight}>触手可及</span>的地方。
        </h1>
        <p className={page.lede}>
          网盘入口已经接入主导航。后续会在这里组织存储源、文件浏览、上传下载和传输队列，
          文件操作继续由主进程安全处理。
        </p>

        <div className={page.stack} aria-label="网盘规划能力">
          <span>文件浏览</span>
          <span>上传下载</span>
          <span>传输队列</span>
        </div>
      </section>

      <aside
        className={styles.placeholderCard}
        aria-labelledby="drive-card-title"
      >
        <div className={styles.placeholderTop}>
          <span className={styles.runtimeKicker}>Workspace</span>
          <span className={styles.placeholderBadge}>
            <span aria-hidden="true" />
            准备中
          </span>
        </div>

        <span className={styles.placeholderMark} aria-hidden="true">
          <CloudIcon />
        </span>

        <h2 id="drive-card-title">网盘工作区正在搭建</h2>
        <p>
          菜单、页面容器和响应式布局已经就绪。下一步可以从文件列表和一个存储源开始。
        </p>

        <div className={styles.placeholderDivider} />
        <p className={styles.placeholderFootnote}>尚未连接存储源</p>
      </aside>
    </main>
  );
}
