"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FolderGit2,
  ListTodo,
  MonitorUp,
  PackageOpen,
  PlayCircle,
  RefreshCw,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type {
  AgentFlowEvent,
  AgentRole,
  Approval,
  Artifact,
  AuditEvent,
  CommandRun,
  ContextSnapshot,
  PreviewSession,
  Task,
  TaskSource,
  Workspace,
} from "@agent-flow/shared";
import { AgentFlowApiClient, createApiClient } from "../lib/api";
import { demoArtifacts, demoEvents, demoTask } from "../lib/demo-data";
import { Logo } from "./logo";

type LoadState = "idle" | "loading" | "error";
type ViewKey = "tasks" | "workspace" | "artifacts" | "approvals" | "audit" | "settings";

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

const demoWorkspace: Workspace = {
  id: "workspace_demo",
  name: "demo-app",
  rootPath: "D:\\project\\demo-app",
  status: "online",
  runnerMode: "simulated",
  branch: "main",
  lastHeartbeatAt: "2026-06-23T00:00:10.000Z",
};

const demoTaskSource: TaskSource = {
  id: "source_demo",
  taskId: demoTask.id,
  kind: "manual",
  title: "增加邮箱登录流程",
  content: "用户在 Web 端选择工作区后输入开发需求，由 Agent 协作完成方案、补丁、审查、测试和报告。",
  createdAt: "2026-06-23T00:00:00.000Z",
};

const demoContextSnapshot: ContextSnapshot = {
  id: "snapshot_demo",
  taskId: demoTask.id,
  selectedFiles: [
    { path: "apps/web/app/login/page.tsx", reason: "登录页面入口", relevance: "high" },
    { path: "apps/web/src/components/auth-form.tsx", reason: "表单组件", relevance: "medium" },
    { path: "packages/shared/src/domain.ts", reason: "共享任务模型", relevance: "medium" },
  ],
  rejectedFiles: [
    { path: ".env.local", reason: "包含本地密钥，不进入 Agent 上下文" },
    { path: "node_modules", reason: "依赖目录过大且无需索引" },
  ],
  createdAt: "2026-06-23T00:00:00.000Z",
};

const demoCommandRuns: CommandRun[] = [
  {
    id: "cmd_lint",
    taskId: demoTask.id,
    command: "pnpm lint",
    status: "passed",
    exitCode: 0,
    startedAt: "2026-06-23T00:00:00.000Z",
    completedAt: "2026-06-23T00:00:04.000Z",
  },
  {
    id: "cmd_test",
    taskId: demoTask.id,
    command: "pnpm test",
    status: "passed",
    exitCode: 0,
    startedAt: "2026-06-23T00:00:05.000Z",
    completedAt: "2026-06-23T00:00:12.000Z",
  },
];

const demoPreviewSession: PreviewSession = {
  id: "preview_demo",
  taskId: demoTask.id,
  workspaceId: demoWorkspace.id,
  status: "running",
  url: "http://127.0.0.1:3001",
  port: 3001,
  command: "pnpm dev",
  startedAt: "2026-06-23T00:00:00.000Z",
};

const demoApprovals: Approval[] = [
  {
    id: "approval_patch",
    taskId: demoTask.id,
    kind: "apply_patch",
    status: "pending",
    payload: { artifactKind: "patch", patchArtifactId: "demo_artifact_patch" },
    createdAt: "2026-06-23T00:00:00.000Z",
  },
  {
    id: "approval_command",
    taskId: demoTask.id,
    kind: "run_command",
    status: "approved",
    payload: { command: "pnpm test" },
    createdAt: "2026-06-23T00:00:00.000Z",
    decidedAt: "2026-06-23T00:00:03.000Z",
  },
];

const demoAuditEvents: AuditEvent[] = [
  audit("user", "task_created", "用户创建任务并绑定 demo-app 工作区"),
  audit("agent", "context_snapshot_created", "上下文 Agent 选择 3 个文件，排除 2 个敏感或无关路径"),
  audit("agent", "patch_created", "编码 Agent 生成 patch 产物"),
  audit("runner", "command_completed", "pnpm test passed"),
  audit("user", "approval_requested", "等待用户审批 patch"),
];

const navItems: Array<{
  key: ViewKey;
  label: string;
  testId: string;
  icon: typeof ListTodo;
}> = [
  { key: "tasks", label: "任务", testId: "nav-tasks", icon: ListTodo },
  { key: "workspace", label: "工作区", testId: "nav-workspace", icon: FolderGit2 },
  { key: "artifacts", label: "产物", testId: "nav-artifacts", icon: PackageOpen },
  { key: "approvals", label: "审批", testId: "nav-approvals", icon: ShieldCheck },
  { key: "audit", label: "审计", testId: "nav-audit", icon: ScrollText },
  { key: "settings", label: "设置", testId: "nav-settings", icon: Settings },
];

const viewCopy: Record<ViewKey, { title: string; description: string }> = {
  tasks: {
    title: "任务工作台",
    description: "创建开发任务，查看模拟 Agent 流程、产物和事件日志",
  },
  workspace: {
    title: "工作区",
    description: "选择本地项目、查看 Runner 状态、管理上下文边界",
  },
  artifacts: {
    title: "产物中心",
    description: "集中查看计划、补丁、审查结果、测试日志和最终报告",
  },
  approvals: {
    title: "审批中心",
    description: "审批高风险动作，确保补丁应用和命令执行都有用户确认",
  },
  audit: {
    title: "审计日志",
    description: "追踪用户、Agent、Runner 和系统关键动作",
  },
  settings: {
    title: "设置",
    description: "配置模型策略、安全边界、质量门禁和预览偏好",
  },
};

export function Dashboard() {
  const [api] = useState(() => createApiClient());
  const [activeView, setActiveView] = useState<ViewKey>("tasks");
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
  const currentViewCopy = viewCopy[activeView];

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
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-item ${activeView === item.key ? "active" : ""}`}
                data-testid={item.testId}
                key={item.key}
                onClick={() => setActiveView(item.key)}
                type="button"
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="runner-mini">
          <strong>V0 API</strong>
          <p>{apiOnline ? "已连接到本地 API。任务、事件和产物来自 V0 服务。" : "API 未连接，当前显示本地示例数据。"}</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{currentViewCopy.title}</h1>
            <p>{currentViewCopy.description}</p>
          </div>
          <div className="actions">
            <span className="sr-only" data-testid="api-status">
              {apiOnline ? "API online" : "demo mode"}
            </span>
            <span className={`badge ${apiOnline ? "green" : "amber"}`}>{apiOnline ? "API 在线" : "示例模式"}</span>
            <button className="btn secondary" onClick={() => void loadTasks(api, setTasks, setSelectedTaskId, setApiOnline, setLoadState)} type="button">
              <RefreshCw size={14} /> 刷新
            </button>
          </div>
        </header>

        <section className="content">{renderActiveView()}</section>
      </main>
    </div>
  );

  function renderActiveView() {
    switch (activeView) {
      case "workspace":
        return <WorkspaceView contextSnapshot={demoContextSnapshot} previewSession={demoPreviewSession} workspace={demoWorkspace} />;
      case "artifacts":
        return (
          <ArtifactsView
            artifacts={artifacts.length > 0 ? artifacts : demoArtifacts}
            commandRuns={demoCommandRuns}
            previewSession={demoPreviewSession}
            source={demoTaskSource}
          />
        );
      case "approvals":
        return <ApprovalsView approvals={demoApprovals} />;
      case "audit":
        return <AuditView auditEvents={demoAuditEvents} events={events.length > 0 ? events : demoEvents} />;
      case "settings":
        return <SettingsView />;
      case "tasks":
      default:
        return (
          <TasksView
            api={api}
            artifacts={artifacts}
            completedEvents={completedEvents}
            disabled={loadState === "loading"}
            events={events}
            formPrompt={formPrompt}
            formTitle={formTitle}
            onArtifactSelect={setSelectedArtifactId}
            onPromptChange={setFormPrompt}
            onSelectTask={setSelectedTaskId}
            onSubmit={handleCreateTask}
            onTitleChange={setFormTitle}
            selectedArtifact={selectedArtifact}
            selectedArtifactId={selectedArtifactId}
            selectedTask={selectedTask}
            selectedTaskId={selectedTaskId}
            tasks={tasks}
          />
        );
    }
  }
}

function TasksView({
  api,
  artifacts,
  completedEvents,
  disabled,
  events,
  formPrompt,
  formTitle,
  onArtifactSelect,
  onPromptChange,
  onSelectTask,
  onSubmit,
  onTitleChange,
  selectedArtifact,
  selectedArtifactId,
  selectedTask,
  selectedTaskId,
  tasks,
}: {
  api: AgentFlowApiClient;
  artifacts: Artifact[];
  completedEvents: number;
  disabled: boolean;
  events: AgentFlowEvent[];
  formPrompt: string;
  formTitle: string;
  onArtifactSelect: (artifactId: string) => void;
  onPromptChange: (value: string) => void;
  onSelectTask: (taskId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  selectedArtifact: Artifact | null;
  selectedArtifactId: string | null;
  selectedTask: Task | null;
  selectedTaskId: string | null;
  tasks: Task[];
}) {
  return (
    <>
      <div className="grid-overview">
        <TaskList tasks={tasks} selectedTaskId={selectedTaskId} onSelect={onSelectTask} />
        <TaskCreateForm
          disabled={disabled}
          prompt={formPrompt}
          title={formTitle}
          onPromptChange={onPromptChange}
          onSubmit={onSubmit}
          onTitleChange={onTitleChange}
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
            onSelect={onArtifactSelect}
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
    </>
  );
}

function WorkspaceView({
  contextSnapshot,
  previewSession,
  workspace,
}: {
  contextSnapshot: ContextSnapshot;
  previewSession: PreviewSession;
  workspace: Workspace;
}) {
  return (
    <div className="view-grid two-col">
      <section className="panel" data-testid="workspace-summary">
        <div className="panel-head">
          <h3>已连接项目</h3>
          <span className="badge green">{workspace.status}</span>
        </div>
        <div className="panel-body detail-list">
          <DetailItem label="名称" value={workspace.name} />
          <DetailItem label="路径" value={workspace.rootPath} />
          <DetailItem label="分支" value={workspace.branch ?? "未读取"} />
          <DetailItem label="Runner" value={`${workspace.runnerMode} · ${workspace.lastHeartbeatAt ?? "无心跳"}`} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>效果预览</h3>
          <span className="badge blue">{previewSession.status}</span>
        </div>
        <div className="panel-body">
          <div className="preview-tile">
            <MonitorUp size={20} />
            <div>
              <strong>{previewSession.url}</strong>
              <span>{previewSession.command} · port {previewSession.port}</span>
            </div>
            <button className="btn secondary" type="button">
              <PlayCircle size={14} /> 全屏预览
            </button>
          </div>
        </div>
      </section>

      <section className="panel span-2">
        <div className="panel-head">
          <h3>上下文快照</h3>
          <span className="badge blue">{contextSnapshot.selectedFiles.length} 个文件</span>
        </div>
        <div className="panel-body context-grid">
          <div className="mini-list">
            <strong>已选择</strong>
            {contextSnapshot.selectedFiles.map((file) => (
              <div className="list-row" key={file.path}>
                <span>{file.path}</span>
                <small>{file.relevance} · {file.reason}</small>
              </div>
            ))}
          </div>
          <div className="mini-list">
            <strong>已排除</strong>
            {contextSnapshot.rejectedFiles.map((file) => (
              <div className="list-row" key={file.path}>
                <span>{file.path}</span>
                <small>{file.reason}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ArtifactsView({
  artifacts,
  commandRuns,
  previewSession,
  source,
}: {
  artifacts: Artifact[];
  commandRuns: CommandRun[];
  previewSession: PreviewSession;
  source: TaskSource;
}) {
  return (
    <div className="view-grid three-col">
      <section className="panel span-2">
        <div className="panel-head">
          <h3>任务来源</h3>
          <span className="badge blue">{source.kind}</span>
        </div>
        <div className="panel-body">
          <div className="notice">
            <strong>{source.title}</strong>
            <br />
            {source.content}
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h3>预览会话</h3>
          <span className="badge green">{previewSession.status}</span>
        </div>
        <div className="panel-body detail-list">
          <DetailItem label="地址" value={previewSession.url} />
          <DetailItem label="命令" value={previewSession.command} />
        </div>
      </section>
      <section className="panel span-2">
        <div className="panel-head">
          <h3>产物列表</h3>
          <span className="badge blue">{artifacts.length} 个</span>
        </div>
        <div className="panel-body artifact-list">
          {artifacts.map((artifact) => (
            <div className="artifact-row" key={artifact.id}>
              <div>
                <strong>{artifact.title}</strong>
                <span>{artifactLabels[artifact.kind]} · {artifact.createdAt}</span>
              </div>
              <code>{artifact.kind}</code>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h3>质量门禁</h3>
          <span className="badge green">passed</span>
        </div>
        <div className="panel-body mini-list">
          {commandRuns.map((run) => (
            <div className="list-row" key={run.id}>
              <span>{run.command}</span>
              <small>{run.status} · exit {run.exitCode ?? "-"}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ApprovalsView({ approvals }: { approvals: Approval[] }) {
  return (
    <div className="view-grid two-col">
      <section className="panel" data-testid="approval-summary">
        <div className="panel-head">
          <h3>待处理审批</h3>
          <span className="badge amber">{approvals.filter((approval) => approval.status === "pending").length} 待处理</span>
        </div>
        <div className="panel-body approval-list">
          {approvals.map((approval) => (
            <div className="approval-row" key={approval.id}>
              <ShieldCheck size={18} />
              <div>
                <strong>{approval.kind === "apply_patch" ? "patch 应用审批" : "命令执行审批"}</strong>
                <span>{approval.status} · {JSON.stringify(approval.payload)}</span>
              </div>
              <span className={`badge ${approval.status === "approved" ? "green" : "amber"}`}>{approval.status}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h3>审批原则</h3>
          <span className="badge blue">V0</span>
        </div>
        <div className="panel-body mini-list">
          <div className="list-row">
            <span>修改本地文件前必须审批 patch</span>
            <small>V0 先展示审批流，V1 接入真实应用补丁。</small>
          </div>
          <div className="list-row">
            <span>运行命令必须经过白名单或用户确认</span>
            <small>降低误执行高风险命令的概率。</small>
          </div>
        </div>
      </section>
    </div>
  );
}

function AuditView({
  auditEvents,
  events,
}: {
  auditEvents: AuditEvent[];
  events: AgentFlowEvent[];
}) {
  return (
    <div className="view-grid two-col">
      <section className="panel" data-testid="audit-log">
        <div className="panel-head">
          <h3>审计事件</h3>
          <span className="badge blue">{auditEvents.length} 条</span>
        </div>
        <div className="panel-body event-list">
          {auditEvents.map((event) => (
            <div className="event-row" key={event.id}>
              <strong>[{event.source}] {event.action}</strong>
              <span>{event.message}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h3>任务事件流</h3>
          <span className="badge green">{events.length} 条</span>
        </div>
        <div className="panel-body log audit-stream">
          {events.slice(0, 10).map((event) => (
            <div key={event.id}>[{event.type}] {event.message}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsView() {
  const gates = ["pnpm lint", "pnpm typecheck", "pnpm test", "pnpm build", "pnpm e2e:v0"];

  return (
    <div className="view-grid three-col">
      <section className="panel">
        <div className="panel-head">
          <h3>模型策略</h3>
          <span className="badge blue">可配置</span>
        </div>
        <div className="panel-body mini-list">
          <div className="list-row">
            <span>规划 / 编码 / 审查 / 测试分角色</span>
            <small>V0 使用模拟流程，V1 接真实 Agent 编排。</small>
          </div>
          <div className="list-row">
            <span>保留人工审批节点</span>
            <small>用户确认后再执行本地高风险动作。</small>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h3>质量门禁</h3>
          <span className="badge green">启用</span>
        </div>
        <div className="panel-body mini-list">
          {gates.map((gate) => (
            <div className="list-row" key={gate}>
              <span>{gate}</span>
              <small>任务合入前必须可追踪。</small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h3>安全边界</h3>
          <span className="badge amber">V0 骨架</span>
        </div>
        <div className="panel-body mini-list">
          <div className="list-row">
            <span>工作区只在用户选择范围内操作</span>
            <small>后续 Runner 会执行路径和命令白名单。</small>
          </div>
          <div className="list-row">
            <span>敏感文件默认排除</span>
            <small>.env、密钥、依赖缓存不进入上下文。</small>
          </div>
        </div>
      </section>
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
              data-testid="task-row"
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
          <input className="input" data-testid="task-title-input" onChange={(event) => onTitleChange(event.target.value)} value={title} />
        </label>
        <label className="field">
          <span>开发需求</span>
          <textarea className="textarea" data-testid="task-prompt-input" onChange={(event) => onPromptChange(event.target.value)} value={prompt} />
        </label>
        <button className="btn" data-testid="task-submit-button" disabled={disabled || !title.trim() || !prompt.trim()} type="submit">
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
        <div className="notice compact">
          最新事件：{events.at(-1)?.type ?? "等待任务启动"}
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
          <div className="step done" data-testid="timeline-step" key={event.id}>
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
            data-testid={`artifact-tab-${artifact.kind}`}
            key={artifact.id}
            onClick={() => onSelect(artifact.id)}
            type="button"
          >
            {artifactLabels[artifact.kind]}
          </button>
        ))}
      </div>
      <div className="artifact-content" data-testid="artifact-content">
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
        <div style={{ height: 8 }} />
        <div className="log" data-testid="event-log">
          {events.slice(-5).map((event) => (
            <div key={event.id}>[{event.type}] {event.message}</div>
          ))}
          {artifacts.length === 0 ? <div>[system] 等待产物生成</div> : null}
        </div>
        <div style={{ height: 8 }} />
        <a className="btn secondary" href={api.streamUrl(task.id)} rel="noreferrer" target="_blank">
          <ExternalLink size={14} /> 打开事件流
        </a>
      </div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function audit(source: AuditEvent["source"], action: string, message: string): AuditEvent {
  return {
    id: `audit_${action}`,
    taskId: demoTask.id,
    workspaceId: demoWorkspace.id,
    source,
    action,
    message,
    createdAt: "2026-06-23T00:00:00.000Z",
  };
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
