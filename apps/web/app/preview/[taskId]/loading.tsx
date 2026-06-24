export default function PreviewLoading() {
  return (
    <main className="preview-screen">
      <header className="preview-toolbar">
        <div>
          <strong>本地预览</strong>
          <span>正在加载预览会话...</span>
        </div>
      </header>
      <section className="preview-empty-state">
        <div className="choice">
          <strong>正在准备</strong>
          <p>正在同步任务状态和本地预览地址。</p>
        </div>
      </section>
    </main>
  );
}
