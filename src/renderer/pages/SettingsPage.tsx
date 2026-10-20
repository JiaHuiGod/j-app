function SlidersIcon() {
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
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

export function SettingsPage() {
  return (
    <main className="content placeholder-view">
      <section className="intro" aria-labelledby="settings-page-title">
        <p className="eyebrow">Preferences / 即将上线</p>
        <h1 id="settings-page-title">
          让应用，
          <br />
          更合<span className="highlight">你的习惯</span>。
        </h1>
        <p className="lede">
          通用、外观和存储偏好将在这里集中管理。网络代理仍然保留在标题栏的独立入口，
          不混入设置页面。
        </p>

        <div className="stack" aria-label="设置规划分类">
          <span>通用</span>
          <span>外观</span>
          <span>存储</span>
        </div>
      </section>

      <aside className="placeholder-card" aria-labelledby="settings-card-title">
        <div className="placeholder-top">
          <span className="runtime-kicker">Settings</span>
          <span className="placeholder-badge">
            <span aria-hidden="true" />
            准备中
          </span>
        </div>

        <span className="placeholder-mark" aria-hidden="true">
          <SlidersIcon />
        </span>

        <h2 id="settings-card-title">设置中心正在搭建</h2>
        <p>
          项目已经具备集中配置存储和类型校验。下一步会把这些能力整理成清晰的设置分组。
        </p>

        <div className="placeholder-divider" />
        <p className="placeholder-footnote">网络代理仍从标题栏打开</p>
      </aside>
    </main>
  );
}
