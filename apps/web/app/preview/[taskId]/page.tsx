"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { PreviewSession, Task } from "@agent-flow/shared";
import { createApiClient } from "../../../src/lib/api";

export default function PreviewPage() {
  const params = useParams<{ taskId: string }>();
  const api = useMemo(() => createApiClient(), []);
  const taskId = typeof params?.taskId === "string" ? params.taskId : "";
  const [task, setTask] = useState<Task | null>(null);
  const [previewSession, setPreviewSession] = useState<PreviewSession | null>(null);

  useEffect(() => {
    if (!taskId) {
      return;
    }

    void Promise.all([
      api.getTask(taskId).catch(() => null),
      api.getPreviewSession(taskId).catch(() => null),
    ]).then(([loadedTask, loadedPreview]) => {
      setTask(loadedTask);
      setPreviewSession(loadedPreview);
    });
  }, [api, taskId]);

  const canEmbed = previewSession && (previewSession.status === "running" || previewSession.status === "starting");

  return (
    <main className="preview-screen">
      <header className="preview-toolbar">
        <div>
          <strong>{task?.title ?? "本地预览"}</strong>
          <span>{previewSession?.url ?? "预览会话不可用"}</span>
        </div>
        <div className="preview-toolbar-actions">
          <span className={`badge ${getPreviewBadgeClass(previewSession?.status)}`}>
            {getPreviewStatusLabel(previewSession?.status)}
          </span>
          {previewSession?.url ? (
            <a className="btn secondary" href={previewSession.url} rel="noreferrer" target="_blank">
              打开原始地址
            </a>
          ) : null}
          <a className="btn" href="/">
            返回工作台
          </a>
        </div>
      </header>

      {canEmbed ? (
        <iframe
          className="preview-frame"
          src={previewSession.url}
          title={`${task?.title ?? taskId} preview`}
        />
      ) : (
        <section className="preview-empty-state">
          <div className="choice">
            <strong>预览未就绪</strong>
            <p>
              {previewSession?.failureMessage ??
                (previewSession?.status === "stopped"
                  ? "当前预览已经停止，请回到工作台重新启动。"
                  : "当前任务还没有可嵌入的预览会话。")}
            </p>
            <div className="kv"><span>任务</span><strong>{task?.title ?? taskId ?? "--"}</strong></div>
            <div className="kv"><span>状态</span><strong>{getPreviewStatusLabel(previewSession?.status)}</strong></div>
            <div className="kv"><span>地址</span><strong>{previewSession?.url ?? "--"}</strong></div>
          </div>
        </section>
      )}
    </main>
  );
}

function getPreviewStatusLabel(status: "starting" | "running" | "stopped" | "failed" | undefined): string {
  if (status === "running") {
    return "运行中";
  }

  if (status === "starting") {
    return "启动中";
  }

  if (status === "failed") {
    return "启动失败";
  }

  return "已停止";
}

function getPreviewBadgeClass(status: "starting" | "running" | "stopped" | "failed" | undefined): string {
  if (status === "running") {
    return "green";
  }

  if (status === "starting") {
    return "blue";
  }

  if (status === "failed") {
    return "red";
  }

  return "amber";
}
