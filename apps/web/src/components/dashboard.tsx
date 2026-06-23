"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Send } from "lucide-react";
import type { AgentFlowEvent, AgentRole, Artifact, Task } from "@agent-flow/shared";
import { AgentFlowApiClient, createApiClient } from "../lib/api";
import { demoArtifacts, demoEvents, demoTask } from "../lib/demo-data";
import { Logo } from "./logo";

type LoadState = "idle" | "loading" | "error";

const agentLabels: Record<AgentRole, string> = {
  planner: "规划",
  context: "上下文",
  coder: "编码",
  reviewer: "审查",
  tester: "测试",
  summary: "总结",
};

const artifactLabels: Record<Artifact["kind"], string> = {
  final_report: "总结",
  patch: "补丁",
  plan: "计划",
  review: "审查",
  test_log: "测试日志",
  workspace_summary: "工作区",
};

export function Dashboard() {
  const [api] = useState(() => createApiClient());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentFlowEvent[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [apiOnline, setApiOnline] = useState(true);
  const [formTitle, setFormTitle] = useState("增加邮箱登录流程");
  const [formPrompt, setFormPrompt] = useState("在现有项目中增加登录页面，支持邮箱和密码登录。");

  useEffect(() => {
    void loadTasks(api, setTasks, setSelectedTaskId, setApiOnline, setLoadState);
  }, [api]);

  useEffect(() => {
    if (!selectedTaskId) {
      setEvents([]);
      setArtifacts([]);
      setSelectedArtifactId(null);
      return;
    }

    void loadTaskDetails(api, selectedTaskId, setEvents, setArtifacts, setSelectedArtifactId, setApiOnline);
    const source = new EventSource(api.streamUrl(selectedTaskId));

    source.onmessage = (message) => {
      const event = JSON.parse(message.data as string) as AgentFlowEvent;
      setEvents((currentEvents) => {
        if (currentEvents.some((currentEvent) => currentEvent.id === event.id)) {
          return currentEvents;
        }

        return [...currentEvents, event];
      });

      if (event.type === "task_completed" || event.type === "task_failed") {
        source.close();
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [api, selectedTaskId]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );
  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null,
    [artifacts, selectedArtifactId],
  );

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadState("loading");

    try {
      const task = await api.createTask({ title: formTitle, prompt: formPrompt });
      const nextTasks = await api.listTasks();
      setTasks(nextTasks);
      setSelectedTaskId(task.id);
      setApiOnline(true);
    } catch {
      const task = { ...demoTask, title: formTitle, prompt: formPrompt };
      setTasks([task]);
      setSelectedTaskId(task.id);
      setEvents(demoEvents);
      setArtifacts(demoArtifacts);
      setSelectedArtifactId(demoArtifacts[0]?.id ?? null);
      setApiOnline(false);
    } finally {
      setLoadState("idle");
    }
  }

  const completedEvents = events.filter((event) => event.type === "agent_completed").length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <div>
            <strong>agent-flow</strong>
            <span>多 Agent 开发流程</span>
          </div>
        </div>
        <nav className="nav" aria-label="主导航">
          <div className="nav-item active"><span className="dot" />任务</div>
          <div className="nav-item"><span className="dot" />工作区</div>
          <div className="nav-item"><span className="dot" />产物</div>
          <div className="nav-item"><span className="dot" />审批</div>
          <div className="nav-item"><span className="dot" />审计</div>
          <div className="nav-item"><span className="dot" />设置</div>
        </nav>
        <div className="runner-mini">
          <strong>V0 API</strong>
          <p>{apiOnline ? "已连接到本地 API。任务、事件和产物来自 V0 服务。" : "API 未连接，当前显示本地示例数据。"}</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>任务工作台</h1>
            <p>创建开发任务，查看模拟 Agent 流程、产物和事件日志</p>
          </div>
          <div className="actions">
            <span className={`badge ${apiOnline ? "green" : "amber"}`}>{apiOnline ? "API 在线" : "示例模式"}</span>
            <button className="btn secondary" onClick={() => void loadTasks(api, setTasks, setSelectedTaskId, setApiOnline, setLoadState)} type="button">
              <RefreshCw size={14} /> 刷新
            </button>
          </div>
        </header>

        <section className="content">
          <div className="grid-overview">
            <TaskList tasks={tasks} selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId} />
            <TaskCreateForm
              disabled={loadState === "loading"}
              prompt={formPrompt}
              title={formTitle}
              onPromptChange={setFormPrompt}
              onSubmit={handleCreateTask}
              onTitleChange={setFormTitle}
            />
            <SummaryPanel artifacts={artifacts} completedEvents={completedEvents} events={events} tasks={tasks} />
          </div>

          {selectedTask ? (
            <div className="grid-detail">
              <Timeline events={events} />
              <ArtifactPanel
                artifacts={artifacts}
                selectedArtifact={selectedArtifact}
                selectedArtifactId={selectedArtifactId}
                onSelect={setSelectedArtifactId}
              />
              <TaskInfo task={selectedTask} events={events} artifacts={artifacts} api={api} />
            </div>
          ) : (
            <div className="panel">
              <div className="panel-body">
                <div className="notice">还没有任务。填写右侧表单创建第一个 V0 开发任务。</div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function TaskList({
  onSelect,
  selectedTaskId,
  tasks,
}: {
  onSelect: (taskId: string) => void;
  selectedTaskId: string | null;
  tasks: Task[];
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>进行中的任务</h3>
        <span className="badge blue">{tasks.length} 个任务</span>
      </div>
      <div className="panel-body task-list">
        {tasks.length === 0 ? (
          <div className="notice">暂无任务。创建任务后会在这里显示。</div>
        ) : (
          tasks.map((task) => (
            <button
              className={`task-row ${selectedTaskId === task.id ? "active" : ""}`}
              key={task.id}
              onClick={() => onSelect(task.id)}
              type="button"
            >
              <span>
                <span className="title">{task.title}</span>
                <span className="desc">{task.prompt}</span>
              </span>
              <span className={`badge ${task.status === "completed" ? "green" : "blue"}`}>{task.status}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function TaskCreateForm({
  disabled,
  onPromptChange,
  onSubmit,
  onTitleChange,
  prompt,
  title,
}: {
  disabled: boolean;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  prompt: string;
  title: string;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>新建开发任务</h3>
        <span className="badge amber">V0 模拟</span>
      </div>
      <form className="panel-body form" onSubmit={onSubmit}>
        <label className="field">
          <span>任务标题</span>
          <input className="input" onChange={(event) => onTitleChange(event.target.value)} value={title} />
        </label>
        <label className="field">
          <span>开发需求</span>
          <textarea className="textarea" onChange={(event) => onPromptChange(event.target.value)} value={prompt} />
        </label>
        <button className="btn" disabled={disabled || !title.trim() || !prompt.trim()} type="submit">
          <Send size={14} /> 启动任务
        </button>
      </form>
    </section>
  );
}

function SummaryPanel({
  artifacts,
  completedEvents,
  events,
  tasks,
}: {
  artifacts: Artifact[];
  completedEvents: number;
  events: AgentFlowEvent[];
  tasks: Task[];
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>运行概况</h3>
        <span className="badge green">V0</span>
      </div>
      <div className="panel-body">
        <div className="metric-grid">
          <div className="metric"><span>任务</span><strong>{tasks.length}</strong></div>
          <div className="metric"><span>Agent</span><strong>{completedEvents}</strong></div>
          <div className="metric"><span>产物</span><strong>{artifacts.length}</strong></div>
        </div>
      </div>
    </section>
  );
}

function Timeline({ events }: { events: AgentFlowEvent[] }) {
  const agentEvents = events.filter((event) => event.agentRole && event.type === "agent_completed");

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>协作时间线</h3>
        <span className="badge blue">{agentEvents.length} 步</span>
      </div>
      <div className="panel-body step-list">
        {agentEvents.map((event) => (
          <div className="step done" key={event.id}>
            <div className="step-icon">{agentLabels[event.agentRole as AgentRole].slice(0, 1)}</div>
            <div>
              <strong>{agentLabels[event.agentRole as AgentRole]} Agent</strong>
              <p>{event.message}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArtifactPanel({
  artifacts,
  onSelect,
  selectedArtifact,
  selectedArtifactId,
}: {
  artifacts: Artifact[];
  onSelect: (artifactId: string) => void;
  selectedArtifact: Artifact | null;
  selectedArtifactId: string | null;
}) {
  return (
    <section className="panel">
      <div className="tabs">
        {artifacts.map((artifact) => (
          <button
            className={`tab ${selectedArtifactId === artifact.id ? "active" : ""}`}
            key={artifact.id}
            onClick={() => onSelect(artifact.id)}
            type="button"
          >
            {artifactLabels[artifact.kind]}
          </button>
        ))}
      </div>
      <div className="artifact-content">
        {selectedArtifact ? (
          <>
            <h3>{selectedArtifact.title}</h3>
            <pre>{selectedArtifact.content}</pre>
          </>
        ) : (
          <div className="notice">暂无产物。</div>
        )}
      </div>
    </section>
  );
}

function TaskInfo({
  api,
  artifacts,
  events,
  task,
}: {
  api: AgentFlowApiClient;
  artifacts: Artifact[];
  events: AgentFlowEvent[];
  task: Task;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>运行详情</h3>
        <span className="badge green">{task.status}</span>
      </div>
      <div className="panel-body">
        <div className="notice">
          SSE 地址：{api.streamUrl(task.id)}
          <br />
          当前 V0 页面会通过 EventSource 订阅任务事件，并按事件 id 去重展示。
        </div>
        <div style={{ height: 12 }} />
        <div className="log">
          {events.slice(-7).map((event) => (
            <div key={event.id}>[{event.type}] {event.message}</div>
          ))}
          {artifacts.length === 0 ? <div>[system] 等待产物生成</div> : null}
        </div>
        <div style={{ height: 12 }} />
        <a className="btn secondary" href={api.streamUrl(task.id)} rel="noreferrer" target="_blank">
          <ExternalLink size={14} /> 打开事件流
        </a>
      </div>
    </section>
  );
}

async function loadTasks(
  api: AgentFlowApiClient,
  setTasks: (tasks: Task[]) => void,
  setSelectedTaskId: (taskId: string | null) => void,
  setApiOnline: (online: boolean) => void,
  setLoadState: (state: LoadState) => void,
) {
  setLoadState("loading");

  try {
    const loadedTasks = await api.listTasks();
    setTasks(loadedTasks);
    setSelectedTaskId((loadedTasks[0]?.id as string | undefined) ?? null);
    setApiOnline(true);
  } catch {
    setTasks([demoTask]);
    setSelectedTaskId(demoTask.id);
    setApiOnline(false);
  } finally {
    setLoadState("idle");
  }
}

async function loadTaskDetails(
  api: AgentFlowApiClient,
  taskId: string,
  setEvents: (events: AgentFlowEvent[]) => void,
  setArtifacts: (artifacts: Artifact[]) => void,
  setSelectedArtifactId: (artifactId: string | null) => void,
  setApiOnline: (online: boolean) => void,
) {
  try {
    const [loadedEvents, loadedArtifacts] = await Promise.all([
      api.listEvents(taskId),
      api.listArtifacts(taskId),
    ]);
    setEvents(loadedEvents);
    setArtifacts(loadedArtifacts);
    setSelectedArtifactId((loadedArtifacts[0]?.id as string | undefined) ?? null);
    setApiOnline(true);
  } catch {
    setEvents(demoEvents);
    setArtifacts(demoArtifacts);
    setSelectedArtifactId(demoArtifacts[0]?.id ?? null);
    setApiOnline(false);
  }
}
