"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentFlowEvent,
  AgentRole,
  Approval,
  Artifact,
  AuditEvent,
  CommandRun,
  ContextSnapshot,
  PatchLifecycle,
  PreviewSession,
  Task,
  TaskSource,
  Workspace,
} from "@agent-flow/shared";
import { AgentFlowApiClient, createApiClient } from "../lib/api";
import { getConsoleRouteState, type ConsoleTaskMode, type ConsoleViewKey } from "../lib/console-route-state";
import { demoArtifacts, demoEvents, demoTask } from "../lib/demo-data";
import { getTaskStatusLabel, getTaskStatusTone, isWaitingForApproval } from "../lib/task-status";
import { resolveWorkspacePresentation } from "../lib/workspaces";
import { Logo } from "./logo";

type LoadState = "idle" | "loading" | "error";
type ViewKey = ConsoleViewKey;
type TaskMode = ConsoleTaskMode;
type PreviewAction = "start" | "restart" | "stop";

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

const emptyWorkspace: Workspace = {
  id: "workspace_empty",
  name: "未连接工作区",
  rootPath: "--",
  status: "offline",
  runnerMode: "local",
};

const demoWorkspaces: Workspace[] = [
  demoWorkspace,
  {
    id: "workspace_admin",
    name: "admin-dashboard",
    rootPath: "D:\\project\\admin-dashboard",
    status: "offline",
    runnerMode: "simulated",
    branch: "main",
    lastHeartbeatAt: "2026-06-23T22:10:00.000Z",
  },
  {
    id: "workspace_mobile",
    name: "mobile-api",
    rootPath: "D:\\project\\mobile-api",
    status: "error",
    runnerMode: "simulated",
    branch: "develop",
    lastHeartbeatAt: "2026-06-23T20:30:00.000Z",
  },
];

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

const demoPatchLifecycle: PatchLifecycle = {
  id: "patch_demo",
  taskId: demoTask.id,
  patchArtifactId: "demo_artifact_patch",
  approvalId: "approval_patch",
  status: "awaiting_approval",
  precheck: {
    status: "passed",
    changedFiles: ["apps/web/app/login/page.tsx", "apps/web/src/components/auth-form.tsx"],
    message: "Patch precheck passed.",
    issues: [],
    checkedAt: "2026-06-23T00:00:00.000Z",
  },
  applyResult: {
    status: "not_started",
    changedFiles: ["apps/web/app/login/page.tsx", "apps/web/src/components/auth-form.tsx"],
    message: "Patch has not been applied yet.",
  },
  createdAt: "2026-06-23T00:00:00.000Z",
  updatedAt: "2026-06-23T00:00:00.000Z",
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
  href: string;
  key: ViewKey;
  label: string;
  testId: string;
}> = [
  { href: "/tasks", key: "tasks", label: "任务", testId: "nav-tasks" },
  { href: "/workspaces", key: "workspace", label: "工作区", testId: "nav-workspace" },
  { href: "/artifacts", key: "artifacts", label: "产物", testId: "nav-artifacts" },
  { href: "/approvals", key: "approvals", label: "审批", testId: "nav-approvals" },
  { href: "/audit", key: "audit", label: "审计", testId: "nav-audit" },
  { href: "/settings", key: "settings", label: "设置", testId: "nav-settings" },
];

const viewCopy: Record<ViewKey, { title: string; description: string }> = {
  tasks: {
    title: "开发任务工作台",
    description: "创建任务、观察 Agent 协作、审批补丁并查看测试结果",
  },
  workspace: {
    title: "选择工作区",
    description: "Agent 任务必须绑定到一个工作区，后续上下文、补丁和测试都围绕它展开。",
  },
  artifacts: {
    title: "产物中心",
    description: "按任务、Agent 和产物类型筛选历史输出",
  },
  approvals: {
    title: "审批中心",
    description: "所有本地写入和敏感执行都必须显式确认",
  },
  audit: {
    title: "审计日志",
    description: "复盘 AI 开发过程中的每一次决策和本地操作",
  },
  settings: {
    title: "设置",
    description: "配置 agent-flow 的模型、流程和本地执行安全策略",
  },
};

export function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const routeState = useMemo(() => getConsoleRouteState(pathname), [pathname]);
  const activeView = routeState.view;
  const taskMode = routeState.taskMode;
  const routeTaskId = routeState.taskId;
  const [api] = useState(() => createApiClient());
  const dashboardLoadIdRef = useRef(0);
  const offlineFallbackTaskRef = useRef<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(routeTaskId);
  const [events, setEvents] = useState<AgentFlowEvent[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [taskSource, setTaskSource] = useState<TaskSource | null>(null);
  const [contextSnapshot, setContextSnapshot] = useState<ContextSnapshot | null>(null);
  const [patchLifecycle, setPatchLifecycle] = useState<PatchLifecycle | null>(null);
  const [commandRuns, setCommandRuns] = useState<CommandRun[]>([]);
  const [previewSession, setPreviewSession] = useState<PreviewSession | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [previewActionId, setPreviewActionId] = useState<PreviewAction | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState(true);
  const [formTitle, setFormTitle] = useState("增加邮箱登录流程");
  const [formPrompt, setFormPrompt] = useState("在现有项目中增加登录页面，支持邮箱和密码登录。");

  useEffect(() => {
    setSelectedTaskId(routeTaskId);
  }, [routeTaskId]);

  useEffect(() => {
    const loadId = dashboardLoadIdRef.current + 1;
    dashboardLoadIdRef.current = loadId;

    void loadDashboardData({
      api,
      fallbackTask: offlineFallbackTaskRef.current,
      preferredTaskId: routeTaskId,
      setApiOnline,
      setApprovals,
      setAuditEvents,
      setLoadState,
      setSelectedTaskId,
      setTasks,
      setWorkspaces,
      shouldApply: () => dashboardLoadIdRef.current === loadId,
    });
  }, [api, routeTaskId]);

  useEffect(() => {
    if (!selectedTaskId) {
      setPreviewError(null);
      setPreviewActionId(null);
      setEvents([]);
      setArtifacts([]);
      setTaskSource(null);
      setContextSnapshot(null);
      setPatchLifecycle(null);
      setCommandRuns([]);
      setPreviewSession(null);
      setSelectedArtifactId(null);
      return;
    }

    setPreviewError(null);
    setContextSnapshot(null);
    setPatchLifecycle(null);
    setCommandRuns([]);
    setPreviewSession(null);
    void loadTaskDetails({
      api,
      setApiOnline,
      setApprovals,
      setArtifacts,
      setAuditEvents,
      setCommandRuns,
      setContextSnapshot,
      setEvents,
      setPatchLifecycle,
      setPreviewSession,
      setSelectedArtifactId,
      setTaskSource,
      taskId: selectedTaskId,
    });
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
  const workspacePresentation = useMemo(
    () =>
      resolveWorkspacePresentation({
        apiOnline,
        workspaces,
        demoWorkspaces,
      }),
    [apiOnline, workspaces],
  );
  const selectedWorkspace = useMemo(
    () =>
      workspacePresentation.workspaces.find((workspace) => workspace.id === selectedTask?.workspaceId) ??
      workspacePresentation.workspaces[0] ??
      emptyWorkspace,
    [selectedTask?.workspaceId, workspacePresentation.workspaces],
  );
  const displayTasks = apiOnline ? tasks : tasks.length > 0 ? tasks : [demoTask];
  const displayWorkspaces = workspacePresentation.workspaces;
  const displayEvents = apiOnline ? events : events.length > 0 ? events : demoEvents;
  const displayArtifacts = apiOnline ? artifacts : artifacts.length > 0 ? artifacts : demoArtifacts;
  const displayApprovals = apiOnline ? approvals : approvals.length > 0 ? approvals : demoApprovals;
  const displayAuditEvents = apiOnline ? auditEvents : auditEvents.length > 0 ? auditEvents : demoAuditEvents;
  const displayTaskSource = taskSource ?? demoTaskSource;
  const displayContextSnapshot = apiOnline ? contextSnapshot : contextSnapshot ?? demoContextSnapshot;
  const displayPatchLifecycle = apiOnline ? patchLifecycle : patchLifecycle ?? demoPatchLifecycle;
  const displayCommandRuns = apiOnline ? commandRuns : commandRuns.length > 0 ? commandRuns : demoCommandRuns;
  const displayPreviewSession = apiOnline ? previewSession : previewSession ?? demoPreviewSession;
  const displaySelectedTask = selectedTask ?? displayTasks[0] ?? null;
  const displaySelectedTaskId = selectedTaskId ?? displaySelectedTask?.id ?? null;
  const selectedArtifact = useMemo(
    () => displayArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? displayArtifacts[0] ?? null,
    [displayArtifacts, selectedArtifactId],
  );

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dashboardLoadIdRef.current += 1;
    setLoadState("loading");

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? formTitle).trim();
    const prompt = String(formData.get("prompt") ?? formPrompt).trim();

    try {
      const task = await api.createTask({ title, prompt });
      offlineFallbackTaskRef.current = null;
      const [nextTasks, nextWorkspaces, nextApprovals, nextAuditEvents, nextTaskSource] = await Promise.all([
        api.listTasks(),
        api.listWorkspaces(),
        api.listApprovals(),
        api.listAuditEvents(),
        api.getTaskSource(task.id),
      ]);
      setTasks(nextTasks);
      setWorkspaces(nextWorkspaces);
      setApprovals(nextApprovals);
      setAuditEvents(nextAuditEvents);
      setTaskSource(nextTaskSource);
      setCommandRuns([]);
      setSelectedTaskId(task.id);
      setApiOnline(true);
      router.push(`/tasks/${task.id}`);
    } catch {
      const task = { ...demoTask, id: `demo_task_${Date.now()}`, title, prompt };
      offlineFallbackTaskRef.current = task;
      setTasks([task]);
      setWorkspaces(demoWorkspaces);
      setSelectedTaskId(task.id);
      setEvents(demoEvents);
      setArtifacts(demoArtifacts);
      setApprovals(demoApprovals);
      setAuditEvents(demoAuditEvents);
      setTaskSource({ ...demoTaskSource, title, content: prompt });
      setContextSnapshot(demoContextSnapshot);
      setPatchLifecycle(demoPatchLifecycle);
      setCommandRuns(demoCommandRuns);
      setSelectedArtifactId(demoArtifacts[0]?.id ?? null);
      setApiOnline(false);
      router.push(`/tasks/${task.id}`);
    } finally {
      setLoadState("idle");
    }
  }

  function openTask(taskId: string): void {
    router.push(`/tasks/${taskId}`);
  }

  async function refreshTaskState(taskId: string): Promise<void> {
    const [nextTasks, nextWorkspaces] = await Promise.all([api.listTasks(), api.listWorkspaces()]);
    setTasks(nextTasks);
    setWorkspaces(nextWorkspaces);

    const resolvedTaskId = nextTasks.find((task) => task.id === taskId)?.id ?? nextTasks[0]?.id ?? null;
    setSelectedTaskId(resolvedTaskId);

    if (!resolvedTaskId) {
      setEvents([]);
      setArtifacts([]);
      setApprovals([]);
      setAuditEvents([]);
      setTaskSource(null);
      setContextSnapshot(null);
      setPatchLifecycle(null);
      setCommandRuns([]);
      setPreviewSession(null);
      setSelectedArtifactId(null);
      return;
    }

    await loadTaskDetails({
      api,
      setApiOnline,
      setApprovals,
      setArtifacts,
      setAuditEvents,
      setCommandRuns,
      setContextSnapshot,
      setEvents,
      setPatchLifecycle,
      setPreviewSession,
      setSelectedArtifactId,
      setTaskSource,
      taskId: resolvedTaskId,
    });
  }

  async function handleApprovalDecision(approval: Approval, decision: "approve" | "reject"): Promise<void> {
    if (!apiOnline) {
      return;
    }

    setApprovalError(null);
    setApprovalActionId(approval.id);

    try {
      if (decision === "approve") {
        await api.approveApproval(approval.id);
      } else {
        await api.rejectApproval(approval.id);
      }

      await refreshTaskState(approval.taskId);
      router.push(`/tasks/${approval.taskId}`);
      setApiOnline(true);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : "审批执行失败，请稍后重试。");
    } finally {
      setApprovalActionId(null);
    }
  }

  async function handlePreviewAction(action: PreviewAction): Promise<void> {
    if (!apiOnline || !displaySelectedTaskId) {
      return;
    }

    setPreviewError(null);
    setPreviewActionId(action);

    try {
      if (action === "start") {
        await api.startPreview(displaySelectedTaskId);
      } else if (action === "restart") {
        await api.restartPreview(displaySelectedTaskId);
      } else {
        await api.stopPreview(displaySelectedTaskId);
      }

      await refreshTaskState(displaySelectedTaskId);
      setApiOnline(true);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "预览操作失败，请稍后重试。");
    } finally {
      setPreviewActionId(null);
    }
  }

  const completedEvents = displayEvents.filter((event) => event.type === "agent_completed").length;
  const pendingApprovalCount = displayApprovals.filter((approval) => approval.status === "pending").length;
  const currentViewCopy = getCurrentViewCopy(activeView, taskMode, displaySelectedTask);
  const currentBrandCopy = getCurrentBrandCopy(activeView, taskMode, apiOnline, selectedWorkspace);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <div>
            <strong>agent-flow</strong>
            <span>{currentBrandCopy.subtitle}</span>
          </div>
        </div>
        <nav className="nav" aria-label="主导航">
          {navItems.map((item) => (
            <Link
              className={`nav-item ${activeView === item.key ? "active" : ""}`}
              data-testid={item.testId}
              href={item.href}
              key={item.key}
            >
              <span className="dot" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="runner-mini">
          <strong>{currentBrandCopy.runnerTitle}</strong>
          <p>{currentBrandCopy.runnerText}</p>
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
            <TopbarActions
              apiOnline={apiOnline}
              onCreateTask={() => router.push("/tasks/new")}
              onOpenApprovals={() => router.push("/approvals")}
              onRefresh={() =>
                void loadDashboardData({
                  api,
                  fallbackTask: offlineFallbackTaskRef.current,
                  preferredTaskId: selectedTaskId,
                  setApiOnline,
                  setApprovals,
                  setAuditEvents,
                  setLoadState,
                  setSelectedTaskId,
                  setTasks,
                  setWorkspaces,
                  shouldApply: () => true,
                })
              }
              pendingApprovalCount={pendingApprovalCount}
              selectedWorkspaceName={selectedWorkspace.name}
              taskMode={taskMode}
              view={activeView}
            />
          </div>
        </header>

        <section className="content">{renderActiveView()}</section>
      </main>
    </div>
  );

  function renderActiveView() {
    switch (activeView) {
      case "workspace":
        return (
          <WorkspaceView
            apiOnline={apiOnline}
            selectedWorkspace={selectedWorkspace}
            showEmptyState={workspacePresentation.showEmptyState}
            workspaces={displayWorkspaces}
          />
        );
      case "artifacts":
        return (
          <ArtifactsView
            apiOnline={apiOnline}
            artifacts={displayArtifacts}
            previewSession={displayPreviewSession}
            selectedTaskId={displaySelectedTaskId}
            source={displayTaskSource}
          />
        );
      case "approvals":
        return (
          <ApprovalsView
            actionApprovalId={approvalActionId}
            apiOnline={apiOnline}
            approvalError={approvalError}
            approvals={displayApprovals}
            onApprove={(approval) => void handleApprovalDecision(approval, "approve")}
            onReject={(approval) => void handleApprovalDecision(approval, "reject")}
            workspaceName={selectedWorkspace.name}
          />
        );
      case "audit":
        return <AuditView apiOnline={apiOnline} auditEvents={displayAuditEvents} />;
      case "settings":
        return <SettingsView />;
      case "tasks":
      default:
        return (
          <TasksView
            api={api}
            apiOnline={apiOnline}
            approvalActionId={approvalActionId}
            approvalError={approvalError}
            approvals={displayApprovals}
            artifacts={displayArtifacts}
            commandRuns={displayCommandRuns}
            contextSnapshot={displayContextSnapshot}
            patchLifecycle={displayPatchLifecycle}
            previewActionId={previewActionId}
            previewError={previewError}
            previewSession={displayPreviewSession}
            completedEvents={completedEvents}
            disabled={loadState === "loading"}
            events={displayEvents}
            formPrompt={formPrompt}
            formTitle={formTitle}
            onApproveApproval={(approval) => void handleApprovalDecision(approval, "approve")}
            onArtifactSelect={setSelectedArtifactId}
            onPromptChange={setFormPrompt}
            onPreviewAction={(action) => void handlePreviewAction(action)}
            onRejectApproval={(approval) => void handleApprovalDecision(approval, "reject")}
            onSelectTask={openTask}
            onSubmit={handleCreateTask}
            onTitleChange={setFormTitle}
            selectedArtifact={selectedArtifact}
            selectedArtifactId={selectedArtifactId}
            selectedWorkspace={selectedWorkspace}
            taskMode={taskMode}
            selectedTask={displaySelectedTask}
            selectedTaskId={displaySelectedTaskId}
            tasks={displayTasks}
          />
        );
    }
  }
}

function TasksView({
  api,
  apiOnline,
  approvalActionId,
  approvalError,
  approvals,
  artifacts,
  commandRuns,
  contextSnapshot,
  patchLifecycle,
  previewActionId,
  previewError,
  previewSession,
  completedEvents,
  disabled,
  events,
  formPrompt,
  formTitle,
  onApproveApproval,
  onArtifactSelect,
  onPromptChange,
  onPreviewAction,
  onRejectApproval,
  onSelectTask,
  onSubmit,
  onTitleChange,
  selectedArtifact,
  selectedArtifactId,
  selectedTask,
  selectedTaskId,
  selectedWorkspace,
  taskMode,
  tasks,
}: {
  api: AgentFlowApiClient;
  apiOnline: boolean;
  approvalActionId: string | null;
  approvalError: string | null;
  approvals: Approval[];
  artifacts: Artifact[];
  commandRuns: CommandRun[];
  contextSnapshot: ContextSnapshot | null;
  patchLifecycle: PatchLifecycle | null;
  previewActionId: PreviewAction | null;
  previewError: string | null;
  previewSession: PreviewSession | null;
  completedEvents: number;
  disabled: boolean;
  events: AgentFlowEvent[];
  formPrompt: string;
  formTitle: string;
  onApproveApproval: (approval: Approval) => void;
  onArtifactSelect: (artifactId: string) => void;
  onPromptChange: (value: string) => void;
  onPreviewAction: (action: PreviewAction) => void;
  onRejectApproval: (approval: Approval) => void;
  onSelectTask: (taskId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  selectedArtifact: Artifact | null;
  selectedArtifactId: string | null;
  selectedTask: Task | null;
  selectedTaskId: string | null;
  selectedWorkspace: Workspace;
  taskMode: TaskMode;
  tasks: Task[];
}) {
  if (taskMode === "create") {
    return (
      <TaskCreateView
        disabled={disabled}
        onPromptChange={onPromptChange}
        onSubmit={onSubmit}
        onTitleChange={onTitleChange}
        prompt={formPrompt}
        workspace={selectedWorkspace}
        title={formTitle}
      />
    );
  }

  if (taskMode === "detail" && selectedTask) {
    return (
      <div className="grid-task">
        <Timeline artifacts={artifacts} events={events} />
        <ArtifactPanel
          artifacts={artifacts}
          selectedArtifact={selectedArtifact}
          selectedArtifactId={selectedArtifactId}
          onSelect={onArtifactSelect}
        />
        <TaskInfo
          apiOnline={apiOnline}
          approvalActionId={approvalActionId}
          approvalError={approvalError}
          approvals={approvals}
          artifacts={artifacts}
          commandRuns={commandRuns}
          contextSnapshot={contextSnapshot}
          patchLifecycle={patchLifecycle}
          previewActionId={previewActionId}
          previewError={previewError}
          previewSession={previewSession}
          events={events}
          onApproveApproval={onApproveApproval}
          onPreviewAction={onPreviewAction}
          onRejectApproval={onRejectApproval}
          task={selectedTask}
          workspace={selectedWorkspace}
        />
      </div>
    );
  }

  const isEmptyState = apiOnline && tasks.length === 0;

  return (
    <>
      {!apiOnline ? (
        <section className="panel">
          <div className="panel-body">
            <div className="notice">API 未连接，当前显示示例数据，可继续预览 V0 页面流程。</div>
          </div>
        </section>
      ) : null}
      {isEmptyState ? (
        <section className="panel">
          <div className="panel-head">
            <h4>暂无任务</h4>
            <span className="badge">空状态</span>
          </div>
          <div className="panel-body">
            <div className="notice">先选择工作区并创建一个开发任务，Agent 结果会在这里汇总展示。</div>
          </div>
        </section>
      ) : (
        <div className="grid-3">
          <TaskList
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelect={onSelectTask}
          />
          <SummaryPanel artifacts={artifacts} completedEvents={completedEvents} events={events} tasks={tasks} />
          <LatestArtifacts artifacts={artifacts} />
        </div>
      )}
    </>
  );
}

function TopbarActions({
  apiOnline,
  onCreateTask,
  onOpenApprovals,
  onRefresh,
  pendingApprovalCount,
  selectedWorkspaceName,
  taskMode,
  view,
}: {
  apiOnline: boolean;
  onCreateTask: () => void;
  onOpenApprovals: () => void;
  onRefresh: () => void;
  pendingApprovalCount: number;
  selectedWorkspaceName: string;
  taskMode: TaskMode;
  view: ViewKey;
}) {
  if (view === "tasks") {
    if (taskMode === "detail") {
      return (
        <>
          <span className={`tag ${pendingApprovalCount > 0 ? "amber" : "blue"}`}>{pendingApprovalCount > 0 ? "待审批" : "已完成"}</span>
          <button className="btn secondary" onClick={onOpenApprovals} type="button">前往审批</button>
        </>
      );
    }

    if (taskMode === "create") {
      return (
        <>
          <span className="tag green">{selectedWorkspaceName}</span>
          <button className="btn" type="submit" form="task-create-form">创建任务</button>
        </>
      );
    }

    return (
        <>
          <span className={`tag ${apiOnline ? "green" : "amber"}`}>{apiOnline ? "Runner 在线" : "示例模式"}</span>
          <span className="tag amber">{pendingApprovalCount} 个待审批</span>
          <button className="btn" data-testid="create-task-view-button" onClick={onCreateTask} type="button">新建任务</button>
        </>
      );
  }

  if (view === "workspace") {
    return (
      <>
        <button className="btn secondary" onClick={onRefresh} type="button">刷新状态</button>
        <button className="btn" type="button">连接工作区</button>
      </>
    );
  }

  if (view === "artifacts") {
    return <button className="btn secondary" type="button">导出</button>;
  }

  if (view === "approvals") {
    return <span className="tag amber">{pendingApprovalCount} 个待审批</span>;
  }

  if (view === "audit") {
    return <button className="btn secondary" type="button">导出日志</button>;
  }

  return <button className="btn" type="button">保存设置</button>;
}

function WorkspaceView({
  apiOnline,
  selectedWorkspace,
  showEmptyState,
  workspaces,
}: {
  apiOnline: boolean;
  selectedWorkspace: Workspace;
  showEmptyState: boolean;
  workspaces: Workspace[];
}) {
  const onlineCount = workspaces.filter((workspace) => workspace.status === "online").length;

  if (showEmptyState) {
    return (
      <div className="grid-3">
        <section className="panel" data-testid="workspace-summary">
          <div className="panel-head"><h4>最近工作区</h4><span className="badge">0 在线</span></div>
          <div className="panel-body">
            <div className="notice">当前还没有已注册的本地工作区。先启动 local runner，再回来选择工作区。</div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h4>当前能力</h4><span className="badge blue">V1 阶段 A</span></div>
          <div className="panel-body split-list">
            <div className="policy"><strong>真实注册</strong><p>工作区来自真实 runner 注册，而不是示例 seed。</p></div>
            <div className="policy"><strong>在线状态</strong><p>通过 heartbeat 维护 runner 在线/离线状态。</p></div>
            <div className="policy"><strong>真实控制台</strong><p>Web 只展示 API 返回的工作区数据。</p></div>
            <div className="policy"><strong>执行边界</strong><p>patch 和命令执行会在后续阶段接入。</p></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h4>下一步</h4><span className="badge amber">需要连接</span></div>
          <div className="panel-body">
            <div className="notice">先运行 agent-flow connect 命令并传入 workspace 路径和 API 地址，让本地项目注册到控制台。</div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="grid-3">
        <section className="panel" data-testid="workspace-summary">
          <div className="panel-head"><h4>最近工作区</h4><span className="badge green">{onlineCount} 在线</span></div>
          <div className="panel-body">
            <ul className="list">
              {workspaces.map((workspace) => (
                <li key={workspace.id}>
                  <span className={workspace.status === "online" ? "check" : "dot"}>
                    {workspace.status === "online" ? "✓" : ""}
                  </span>
                  <div>
                    <strong>{workspace.name}</strong>
                    <div className="desc">
                      {workspace.rootPath} · {workspace.status === "online" ? "Runner 在线" : workspace.status === "error" ? "连接异常" : "未连接"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h4>当前能力</h4><span className="badge blue">骨架版</span></div>
          <div className="panel-body split-list">
            <div className="policy"><strong>可创建任务</strong><p>需求会绑定到当前工作区。</p></div>
            <div className="policy"><strong>可展示产物</strong><p>计划、补丁、审查、测试报告。</p></div>
            <div className="policy"><strong>模拟 Runner</strong><p>V0 不执行真实命令。</p></div>
            <div className="policy"><strong>安全边界</strong><p>本地操作留到 V2。</p></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h4>下一步</h4><span className="badge amber">需要选择</span></div>
          <div className="panel-body">
            <div className="notice">
              {!apiOnline
                ? "API 未连接，当前显示示例工作区。恢复连接后可以绑定真实工作区。"
                : selectedWorkspace.status === "error"
                  ? "当前工作区连接异常，请先恢复 Runner 再发起任务。"
                  : "选择工作区后，用户可以输入开发需求、Bug 描述或错误日志，让 Agent 基于该工作区生成计划和补丁。"}
            </div>
            <div style={{ height: 12 }} />
            <button className="btn" type="button">基于 {selectedWorkspace.name} 新建任务</button>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h4>工作区审计摘要</h4><span className="badge">最近事件</span></div>
        <table>
          <thead><tr><th>时间</th><th>来源</th><th>事件</th><th>结果</th></tr></thead>
          <tbody>
            {workspaces.slice(0, 3).map((workspace, index) => (
              <tr key={workspace.id}>
                <td>{index === 0 ? "刚刚" : `${index + 1} 分钟前`}</td>
                <td>{index === 0 ? "Runner" : index === 1 ? "用户" : "系统"}</td>
                <td>{index === 0 ? `同步 ${workspace.name} 状态` : index === 1 ? `选择 ${workspace.name}` : `加载 ${workspace.name}`}</td>
                <td>
                  <span className={`badge ${workspace.status === "online" ? "green" : workspace.status === "error" ? "red" : "blue"}`}>
                    {workspace.status === "online" ? "在线" : workspace.status === "error" ? "异常" : "已记录"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function ArtifactsView({
  apiOnline,
  artifacts,
  previewSession,
  selectedTaskId,
  source,
}: {
  apiOnline: boolean;
  artifacts: Artifact[];
  previewSession: PreviewSession | null;
  selectedTaskId: string | null;
  source: TaskSource;
}) {
  const artifactRows = artifacts.length > 0 ? artifacts.slice(0, 3) : demoArtifacts.slice(0, 3);

  return (
    <div className="grid-main-side">
      <section className="panel">
        <div className="panel-head">
          <h4>产物列表</h4>
          <span className="badge">{artifactRows.length} 条</span>
        </div>
        <table>
          <thead>
            <tr><th>产物</th><th>类型</th><th>任务</th><th>Agent</th><th>时间</th></tr>
          </thead>
          <tbody>
            {artifactRows.map((artifact, index) => (
              <tr key={artifact.id}>
                <td>
                  <div className="title">{index === 1 ? "patch.diff" : artifact.title}</div>
                  <div className="desc">
                    {index === 0 ? "登录流程拆解" : index === 1 ? "4 个文件变更" : "无阻塞问题"}
                  </div>
                </td>
                <td>{index === 0 ? "Plan" : index === 1 ? "Patch" : "Review"}</td>
                <td>{source.title}</td>
                <td>{index === 0 ? "规划" : index === 1 ? "编码" : "审查"}</td>
                <td>{index === 0 ? "2 分钟前" : index === 1 ? "1 分钟前" : "刚刚"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h4>预览</h4>
          <span className={`badge ${getPreviewBadgeTone(previewSession?.status)}`}>
            {getPreviewStatusLabel(previewSession?.status)}
          </span>
        </div>
        <div className="panel-body">
          <PreviewPanel
            apiOnline={apiOnline}
            previewActionId={null}
            previewError={null}
            previewSession={previewSession}
            taskId={selectedTaskId}
            onAction={() => undefined}
            readOnly
          />
        </div>
      </section>
    </div>
  );
}

function ApprovalsView({
  actionApprovalId,
  apiOnline,
  approvalError,
  approvals,
  onApprove,
  onReject,
  workspaceName,
}: {
  actionApprovalId: string | null;
  apiOnline: boolean;
  approvalError: string | null;
  approvals: Approval[];
  onApprove: (approval: Approval) => void;
  onReject: (approval: Approval) => void;
  workspaceName: string;
}) {
  const pendingCount = approvals.filter((approval) => approval.status === "pending").length;
  const rows = approvals.length > 0 ? approvals : [];

  return (
    <section className="panel" data-testid="approval-summary">
      <div className="panel-head">
        <h4>待处理审批</h4>
        <span className="badge amber">{pendingCount > 0 ? "需要确认" : "等待补丁"}</span>
      </div>
      {approvalError ? (
        <div className="panel-body">
          <div className="notice">{approvalError}</div>
        </div>
      ) : null}
      <table>
        <thead>
          <tr><th>操作</th><th>任务</th><th>工作区</th><th>风险</th><th>状态</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <div className="notice">当前没有待处理审批，新的补丁或命令申请会出现在这里。</div>
              </td>
            </tr>
          ) : null}
          {rows.map((approval) => (
            <tr key={approval.id}>
              <td>
                <div className="title">{getApprovalTitle(approval)}</div>
                <div className="desc">{getApprovalDescription(approval)}</div>
              </td>
              <td>{approval.taskId.slice(0, 12)}</td>
              <td>{workspaceName}</td>
              <td><span className={`badge ${getApprovalRiskTone(approval)}`}>{getApprovalRiskLabel(approval)}</span></td>
              <td>
                {approval.status === "pending" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      data-testid={`approve-${approval.id}`}
                      disabled={!apiOnline || actionApprovalId === approval.id}
                      onClick={() => onApprove(approval)}
                      type="button"
                    >
                      {actionApprovalId === approval.id ? "处理中" : "批准"}
                    </button>
                    <button
                      className="btn secondary"
                      data-testid={`reject-${approval.id}`}
                      disabled={!apiOnline || actionApprovalId === approval.id}
                      onClick={() => onReject(approval)}
                      type="button"
                    >
                      拒绝
                    </button>
                  </div>
                ) : (
                  <span className={`badge ${approval.status === "approved" ? "green" : "red"}`}>
                    {approval.status === "approved" ? "已批准" : "已拒绝"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AuditView({
  apiOnline,
  auditEvents,
}: {
  apiOnline: boolean;
  auditEvents: AuditEvent[];
}) {
  const rows = auditEvents.length > 0 ? auditEvents : [];

  return (
    <section className="panel" data-testid="audit-log">
      <div className="panel-head">
        <h4>事件流</h4>
        <span className="badge">今天</span>
      </div>
      <table>
        <thead>
          <tr><th>时间</th><th>来源</th><th>事件</th><th>结果</th></tr>
        </thead>
        <tbody>
          {!apiOnline ? (
            <tr>
              <td colSpan={4}>
                <div className="notice">API 未连接，当前显示示例审计记录。</div>
              </td>
            </tr>
          ) : null}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>
                <div className="notice">当前还没有审计记录，任务开始后会自动写入。</div>
              </td>
            </tr>
          ) : null}
          {rows.map((event) => (
            <tr key={event.id}>
              <td>{formatClock(event.createdAt)}</td>
              <td>{event.source}</td>
              <td>{event.action}</td>
              <td>
                <span className={`badge ${event.action.includes("failed") ? "red" : event.action.includes("approval") ? "amber" : "green"}`}>
                  {event.action.includes("failed") ? "失败" : event.action.includes("approval") ? "待处理" : "成功"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SettingsView() {
  return (
    <div className="grid-2">
      <section className="panel">
        <div className="panel-head">
          <h4>模型配置</h4>
          <span className="badge green">可用</span>
        </div>
        <div className="panel-body form">
          <label className="field">
            <span>模型供应商</span>
            <div className="select">OpenAI-compatible Provider</div>
          </label>
          <label className="field">
            <span>默认模型</span>
            <input className="input" readOnly value="gpt-4.1" />
          </label>
          <label className="field">
            <span>结构化输出校验</span>
            <div className="select">开启，失败时重试 1 次</div>
          </label>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h4>安全默认值</h4>
          <span className="badge blue">推荐</span>
        </div>
        <div className="panel-body split-list">
          <div className="policy"><strong>写入审批</strong><p>所有 patch 必须手动审批。</p></div>
          <div className="policy"><strong>命令白名单</strong><p>只允许测试、Lint、类型检查。</p></div>
          <div className="policy"><strong>敏感文件</strong><p>默认拒绝 .env、密钥、证书。</p></div>
          <div className="policy"><strong>审计日志</strong><p>保留所有任务事件和本地命令。</p></div>
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
    <section className="panel task-list-panel">
      <div className="panel-head">
        <h4>进行中的任务</h4>
        <span className="badge blue">{tasks.length} 个任务</span>
      </div>
      <div className="task-table-scroll">
        <table>
          <thead>
            <tr><th>任务</th><th>阶段</th><th>风险</th><th>更新时间</th></tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr className={selectedTaskId === task.id ? "selected" : ""} data-testid="task-row" key={task.id} onClick={() => onSelect(task.id)}>
                <td>
                  <button className="task-open" data-testid={`task-open-${task.id}`} onClick={() => onSelect(task.id)} type="button">
                    <div className="title">{task.title}</div>
                    <div className="desc">{task.prompt}</div>
                  </button>
                </td>
                <td><span className={`badge ${getTaskStatusTone(task.status)}`}>{getTaskStatusLabel(task.status)}</span></td>
                <td><span className="badge amber">中</span></td>
                <td>{formatClock(task.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TaskCreateForm({
  disabled,
  embedded,
  id,
  onPromptChange,
  onSubmit,
  onTitleChange,
  prompt,
  title,
}: {
  disabled: boolean;
  embedded?: boolean;
  id?: string;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  prompt: string;
  title: string;
}) {
  const form = (
    <form className="panel-body form" id={id} onSubmit={onSubmit}>
      <label className="field">
        <span>任务标题</span>
        <input className="input" data-testid="task-title-input" name="title" onChange={(event) => onTitleChange(event.target.value)} value={title} />
      </label>
      <label className="field">
        <span>开发需求</span>
        <textarea className="textarea" data-testid="task-prompt-input" name="prompt" onChange={(event) => onPromptChange(event.target.value)} value={prompt} />
      </label>
      <button className="btn" data-testid="task-submit-button" disabled={disabled || !title.trim() || !prompt.trim()} type="submit">
        启动任务
      </button>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h4>任务内容</h4>
        <span className="badge green">Runner 已连接</span>
      </div>
      {form}
    </section>
  );
}

function TaskCreateView({
  disabled,
  onPromptChange,
  onSubmit,
  onTitleChange,
  prompt,
  title,
  workspace,
}: {
  disabled: boolean;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  prompt: string;
  title: string;
  workspace: Workspace;
}) {
  return (
    <div className="grid-main-side">
      <section className="panel">
        <div className="panel-head"><h4>需求内容</h4><span className="badge green">手动输入</span></div>
        <div className="panel-body form">
          <div className="split-list">
            <div className="choice"><strong>手动需求</strong><p>直接描述要开发的功能或优化。</p></div>
            <div className="choice"><strong>错误日志</strong><p>粘贴报错、测试失败或控制台日志。</p></div>
            <div className="choice"><strong>需求文档</strong><p>从文档摘取目标、约束和验收标准。</p></div>
            <div className="choice"><strong>GitHub Issue</strong><p>V3 支持导入，不作为主入口。</p></div>
          </div>
          <TaskCreateForm
            disabled={disabled}
            embedded
            id="task-create-form"
            onPromptChange={onPromptChange}
            onSubmit={onSubmit}
            onTitleChange={onTitleChange}
            prompt={prompt}
            title={title}
          />
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h4>任务约束</h4><span className="badge amber">审批前不写入</span></div>
        <div className="panel-body">
          <div className="kv"><span>绑定工作区</span><strong>{workspace.name}</strong></div>
          <div className="kv"><span>允许范围</span><strong>src/app/login</strong></div>
          <div className="kv"><span>检查命令</span><strong>pnpm test</strong></div>
          <div className="kv"><span>敏感文件</span><strong>拒绝读取</strong></div>
          <div className="kv"><span>写入策略</span><strong>先生成补丁</strong></div>
          <div className="log">
            <div>[source] manual requirement</div>
            <div>[workspace] {workspace.name} selected</div>
            <div>[policy] write requires approval</div>
          </div>
        </div>
      </section>
    </div>
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
        <h4>运行概况</h4>
        <span className="badge green">{tasks.length > 0 ? "正常" : "等待任务"}</span>
      </div>
      <div className="panel-body">
        <div className="metric-grid">
          <div className="metric"><span>Agent</span><strong>{completedEvents}</strong></div>
          <div className="metric"><span>事件</span><strong>{events.length}</strong></div>
          <div className="metric"><span>产物</span><strong>{artifacts.length}</strong></div>
        </div>
      </div>
    </section>
  );
}

function LatestArtifacts({ artifacts }: { artifacts: Artifact[] }) {
  const latest = artifacts.slice(0, 3);

  return (
    <section className="panel">
      <div className="panel-head"><h4>最新产物</h4><span className="badge">今天</span></div>
      <div className="panel-body">
        {latest.length > 0 ? (
          <ul className="list">
            {latest.map((artifact) => (
              <li key={artifact.id}><span className="check">✓</span>{artifact.title}</li>
            ))}
          </ul>
        ) : (
          <div className="notice">任务开始后，这里会展示最新生成的产物。</div>
        )}
      </div>
    </section>
  );
}

function Timeline({
  artifacts,
  events,
}: {
  artifacts: Artifact[];
  events: AgentFlowEvent[];
}) {
  const eventMap = new Map(events.filter((event) => event.agentRole).map((event) => [event.agentRole as AgentRole, event]));
  const hasWorkspaceSummary = artifacts.some((artifact) => artifact.kind === "workspace_summary");
  const steps: Array<{ role: AgentRole; status: "done" | "active" | "wait" | "idle"; note: string }> = [
    { role: "planner", status: eventMap.has("planner") ? "done" : "idle", note: "生成实现步骤和验收标准。" },
    { role: "context", status: hasWorkspaceSummary ? "done" : "idle", note: "从工作区选择相关文件并生成摘要。" },
    { role: "coder", status: eventMap.has("coder") ? "done" : "active", note: "生成登录表单和测试补丁。" },
    { role: "reviewer", status: eventMap.has("reviewer") ? "done" : "wait", note: "等待检查补丁风险。" },
    { role: "tester", status: eventMap.has("tester") ? "done" : "idle", note: "审批后分析测试日志。" },
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <h4>协作时间线</h4>
        <span className="badge blue">运行中</span>
      </div>
      <div className="panel-body step-list">
        {steps.map((step) => (
          <div className={`step ${step.status === "idle" ? "" : step.status}`} data-testid="timeline-step" key={step.role}>
            <div className="step-icon">{agentLabels[step.role].slice(0, 1)}</div>
            <div>
              <strong>{agentLabels[step.role]} Agent</strong>
              <p>{eventMap.get(step.role)?.message ?? step.note}</p>
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
          renderArtifactPreview(selectedArtifact)
        ) : (
          <div className="notice">暂无产物。</div>
        )}
      </div>
    </section>
  );
}

function TaskInfo({
  apiOnline,
  approvalActionId,
  approvalError,
  approvals,
  artifacts,
  commandRuns,
  contextSnapshot,
  events,
  onPreviewAction,
  onApproveApproval,
  onRejectApproval,
  patchLifecycle,
  previewActionId,
  previewError,
  previewSession,
  task,
  workspace,
}: {
  apiOnline: boolean;
  approvalActionId: string | null;
  approvalError: string | null;
  approvals: Approval[];
  artifacts: Artifact[];
  commandRuns: CommandRun[];
  contextSnapshot: ContextSnapshot | null;
  events: AgentFlowEvent[];
  onPreviewAction: (action: PreviewAction) => void;
  onApproveApproval: (approval: Approval) => void;
  onRejectApproval: (approval: Approval) => void;
  patchLifecycle: PatchLifecycle | null;
  previewActionId: PreviewAction | null;
  previewError: string | null;
  previewSession: PreviewSession | null;
  task: Task;
  workspace: Workspace;
}) {
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const changedFileCount =
    patchLifecycle?.precheck.changedFiles.length ??
    (artifacts.some((artifact) => artifact.kind === "patch") ? 1 : 0);
  const nextCommand = commandRuns[commandRuns.length - 1]?.command ?? "pnpm test";

  return (
    <section className="panel">
      <div className="panel-head">
        <h4>{"\u8fd0\u884c\u8be6\u60c5"}</h4>
        <span className={`badge ${task.status === "failed" ? "red" : "amber"}`}>
          {task.status === "failed" ? "\u5931\u8d25" : "\u5ba1\u6279\u95e8\u7981"}
        </span>
      </div>
      <div className="panel-body">
        <TaskStageSummary task={task} />
        <div className="kv"><span>{"\u5de5\u4f5c\u533a"}</span><strong>{workspace.name}</strong></div>
        <div className="kv"><span>{"\u5206\u652f"}</span><strong>{workspace.branch ?? "main"}</strong></div>
        <div className="kv"><span>{"\u6539\u52a8\u6587\u4ef6"}</span><strong>{changedFileCount}</strong></div>
        <div className="kv"><span>{"\u98ce\u9669\u7b49\u7ea7"}</span><strong>{getPatchLifecycleRiskLabel(patchLifecycle)}</strong></div>
        <div className="kv"><span>{"\u4e0b\u4e00\u6b65\u547d\u4ee4"}</span><strong>{nextCommand}</strong></div>
        <div style={{ height: 8 }} />
        <PatchLifecyclePanel lifecycle={patchLifecycle} />
        <div style={{ height: 8 }} />
        <CommandRunsPanel commandRuns={commandRuns} />
        <div style={{ height: 8 }} />
        <ContextSnapshotPanel snapshot={contextSnapshot} />
        <div style={{ height: 8 }} />
        <PreviewPanel
          apiOnline={apiOnline}
          previewActionId={previewActionId}
          previewError={previewError}
          previewSession={previewSession}
          taskId={task.id}
          onAction={onPreviewAction}
        />
        <div style={{ height: 8 }} />
        {approvalError ? <div className="notice">{approvalError}</div> : null}
        {pendingApprovals.length > 0 ? (
          <div className="split-list">
            {pendingApprovals.map((approval) => (
              <div className="choice" key={approval.id}>
                <strong>{getApprovalTitle(approval)}</strong>
                <p>{getApprovalDescription(approval)}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <button
                    className="btn"
                    disabled={!apiOnline || approvalActionId === approval.id}
                    onClick={() => onApproveApproval(approval)}
                    type="button"
                  >
                    {approvalActionId === approval.id ? "\u5904\u7406\u4e2d" : "\u6279\u51c6"}
                  </button>
                  <button
                    className="btn secondary"
                    disabled={!apiOnline || approvalActionId === approval.id}
                    onClick={() => onRejectApproval(approval)}
                    type="button"
                  >
                    {"\u62d2\u7edd"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {task.status === "failed" ? (
          <div className="notice">
            {"\u4efb\u52a1\u6267\u884c\u5931\u8d25\uff0c\u8bf7\u5148\u67e5\u770b\u5ba1\u8ba1\u65e5\u5fd7\u548c\u6d4b\u8bd5\u8f93\u51fa\uff0c\u518d\u51b3\u5b9a\u662f\u5426\u91cd\u65b0\u751f\u6210\u8865\u4e01\u3002"}
          </div>
        ) : null}
        <div className="log" data-testid="event-log">
          {events.slice(-5).map((event) => (
            <div key={event.id}>[{event.type}] {event.message}</div>
          ))}
          {artifacts.length === 0 ? <div>[system] {"\u7b49\u5f85\u4ea7\u7269\u751f\u6210"}</div> : null}
        </div>
      </div>
    </section>
  );
}

export function PatchLifecyclePanel({ lifecycle }: { lifecycle: PatchLifecycle | null }) {
  if (!lifecycle) {
    return (
      <div className="notice" data-testid="patch-lifecycle-empty">
        {"Patch lifecycle \u751f\u6210\u540e\uff0c\u8fd9\u91cc\u4f1a\u5c55\u793a precheck\u3001\u5ba1\u6279\u548c apply \u7ed3\u679c\u3002"}
      </div>
    );
  }

  return (
    <div className="choice" data-testid="patch-lifecycle">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong>{"Patch \u751f\u547d\u5468\u671f"}</strong>
        <span className={`badge ${getPatchLifecycleTone(lifecycle.status)}`}>{getPatchLifecycleLabel(lifecycle.status)}</span>
      </div>
      <p>{lifecycle.precheck.message}</p>
      <div className="kv"><span>{"Artifact"}</span><strong>{lifecycle.patchArtifactId}</strong></div>
      <div className="kv"><span>{"Precheck"}</span><strong>{getPatchPrecheckLabel(lifecycle.precheck.status)}</strong></div>
      <div className="kv"><span>{"Apply"}</span><strong>{getPatchApplyLabel(lifecycle.applyResult?.status)}</strong></div>
      <ul className="list" data-testid="patch-lifecycle-files">
        {lifecycle.precheck.changedFiles.map((file) => (
          <li key={file}><span className="check">+</span>{file}</li>
        ))}
      </ul>
      {lifecycle.precheck.issues.length > 0 ? (
        <ul className="list" data-testid="patch-lifecycle-issues">
          {lifecycle.precheck.issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>
              <span className="check">!</span>
              <div>
                <strong>{issue.code}</strong>
                <p>{issue.message}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {lifecycle.applyResult ? <p data-testid="patch-lifecycle-apply-message">{lifecycle.applyResult.message}</p> : null}
    </div>
  );
}

export function CommandRunsPanel({ commandRuns }: { commandRuns: CommandRun[] }) {
  if (commandRuns.length === 0) {
    return (
      <div className="notice" data-testid="command-runs-empty">
        {"命令验证生成后，这里会展示队列、执行结果和输出摘要。"}
      </div>
    );
  }

  return (
    <div className="choice" data-testid="command-runs">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong>{"命令验证"}</strong>
        <span className="badge blue">{commandRuns.length}</span>
      </div>
      <ul className="list" data-testid="command-runs-list">
        {commandRuns.map((commandRun) => (
          <li key={commandRun.id}>
            <span className="check">{getCommandRunIcon(commandRun.status)}</span>
            <div style={{ flex: 1 }}>
              <strong>{commandRun.command}</strong>
              <p>{getCommandRunSummary(commandRun)}</p>
              {commandRun.stdout ? <p data-testid={`command-run-stdout-${commandRun.id}`}>{commandRun.stdout.trim()}</p> : null}
              {commandRun.stderr ? <p data-testid={`command-run-stderr-${commandRun.id}`}>{commandRun.stderr.trim()}</p> : null}
            </div>
            <span className={`badge ${getCommandRunTone(commandRun.status)}`}>{getCommandRunLabel(commandRun.status)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TaskStageSummary({ task }: { task: Task }) {
  return (
    <div className="kv" data-testid="task-stage">
      <span>{"任务阶段"}</span>
      <strong>{getTaskStageLabel(task.stage)}</strong>
    </div>
  );
}

export function ContextSnapshotPanel({ snapshot }: { snapshot: ContextSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="notice" data-testid="context-snapshot-empty">
        上下文快照生成后，这里会展示保留文件和排除原因。
      </div>
    );
  }

  return (
    <div className="split-list" data-testid="context-snapshot">
      <div className="choice">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong>保留上下文</strong>
          <span className="badge green">{snapshot.selectedFiles.length}</span>
        </div>
        <p>说明当前任务为什么读取这些文件。</p>
        <ul className="list" data-testid="context-selected-list">
          {snapshot.selectedFiles.map((file) => (
            <li key={file.path}>
              <span className="check">✓</span>
              <div style={{ flex: 1 }}>
                <strong>{file.path}</strong>
                <p>{file.reason}</p>
              </div>
              <span className={`badge ${getContextRelevanceTone(file.relevance)}`}>{getContextRelevanceLabel(file.relevance)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="choice">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong>排除路径</strong>
          <span className="badge amber">{snapshot.rejectedFiles.length}</span>
        </div>
        <p>说明哪些路径被排除，以及为什么不进入本轮上下文。</p>
        <ul className="list" data-testid="context-rejected-list">
          {snapshot.rejectedFiles.map((file) => (
            <li key={file.path}>
              <span className="check">!</span>
              <div>
                <strong>{file.path}</strong>
                <p>{file.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PreviewPanel({
  apiOnline,
  previewActionId,
  previewError,
  previewSession,
  taskId,
  onAction,
  readOnly = false,
}: {
  apiOnline: boolean;
  previewActionId: PreviewAction | null;
  previewError: string | null;
  previewSession: PreviewSession | null;
  taskId: string | null;
  onAction: (action: PreviewAction) => void;
  readOnly?: boolean;
}) {
  if (!previewSession) {
    return (
      <div className="choice" data-testid="preview-empty">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong>本地预览</strong>
          <span className="badge">未启动</span>
        </div>
        <p>当前任务还没有预览会话。启动后会绑定本地 dev server，并保留 URL、端口和状态。</p>
        {!readOnly ? (
          <div className="preview-actions">
            <button
              className="btn"
              data-testid="preview-start"
              disabled={!apiOnline || !taskId || previewActionId !== null}
              onClick={() => onAction("start")}
              type="button"
            >
              {previewActionId === "start" ? "启动中" : "启动预览"}
            </button>
          </div>
        ) : null}
        {previewError ? <div className="notice compact">{previewError}</div> : null}
      </div>
    );
  }

  const allowOpen = apiOnline && Boolean(taskId) && previewSession.status !== "failed" && previewSession.status !== "stopped";

  return (
    <div className="choice" data-testid="preview-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong>本地预览</strong>
        <span className={`badge ${getPreviewBadgeTone(previewSession.status)}`} data-testid="preview-status">
          {getPreviewStatusLabel(previewSession.status)}
        </span>
      </div>
      <p>
        {previewSession.failureMessage
          ? previewSession.failureMessage
          : previewSession.status === "running"
            ? "预览已运行，可直接打开全屏查看当前工作区效果。"
            : previewSession.status === "starting"
              ? "预览正在启动，Runner 会轮询本地 dev server 健康状态。"
              : "预览已停止，可重新启动。"}
      </p>
      <div className="kv"><span>URL</span><strong data-testid="preview-url">{previewSession.url || "--"}</strong></div>
      <div className="kv"><span>端口</span><strong>{previewSession.port > 0 ? previewSession.port : "--"}</strong></div>
      <div className="kv"><span>命令</span><strong>{previewSession.command}</strong></div>
      <div className="kv"><span>开始时间</span><strong>{formatDateTime(previewSession.startedAt)}</strong></div>
      {previewSession.stoppedAt ? (
        <div className="kv"><span>停止时间</span><strong>{formatDateTime(previewSession.stoppedAt)}</strong></div>
      ) : null}
      {previewSession.lastHeartbeatAt ? (
        <div className="kv"><span>最近心跳</span><strong>{formatDateTime(previewSession.lastHeartbeatAt)}</strong></div>
      ) : null}
      <div className="preview-actions">
        {allowOpen ? (
          <a
            className="btn secondary"
            data-testid="preview-open"
            href={`/preview/${taskId}`}
            rel="noreferrer"
            target="_blank"
          >
            全屏预览
          </a>
        ) : null}
        {!readOnly ? (
          <>
            {previewSession.status === "running" || previewSession.status === "starting" ? (
              <>
                <button
                  className="btn"
                  data-testid="preview-restart"
                  disabled={!apiOnline || previewActionId !== null}
                  onClick={() => onAction("restart")}
                  type="button"
                >
                  {previewActionId === "restart" ? "重启中" : "重启预览"}
                </button>
                <button
                  className="btn secondary"
                  data-testid="preview-stop"
                  disabled={!apiOnline || previewActionId !== null}
                  onClick={() => onAction("stop")}
                  type="button"
                >
                  {previewActionId === "stop" ? "停止中" : "停止预览"}
                </button>
              </>
            ) : (
              <button
                className="btn"
                data-testid="preview-start"
                disabled={!apiOnline || !taskId || previewActionId !== null}
                onClick={() => onAction("start")}
                type="button"
              >
                {previewActionId === "start" ? "启动中" : "启动预览"}
              </button>
            )}
          </>
        ) : null}
      </div>
      {previewError ? <div className="notice compact">{previewError}</div> : null}
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

function getApprovalTitle(approval: Approval): string {
  if (approval.kind === "apply_patch") {
    return typeof approval.payload.artifactTitle === "string" ? approval.payload.artifactTitle : "应用 patch.diff";
  }

  return typeof approval.payload.command === "string" ? `运行 ${approval.payload.command}` : "运行受控命令";
}

function getApprovalDescription(approval: Approval): string {
  if (approval.kind === "apply_patch") {
    return "将已生成的补丁写入到本地工作区，写入前会进行路径和 patch 校验。";
  }

  const command = typeof approval.payload.command === "string" ? approval.payload.command : "白名单命令";
  return `批准后 Runner 会在工作区内执行 ${command}，并回写 stdout/stderr。`;
}

function getApprovalRiskTone(approval: Approval): "amber" | "green" {
  return approval.kind === "apply_patch" ? "amber" : "green";
}

function getApprovalRiskLabel(approval: Approval): string {
  return approval.kind === "apply_patch" ? "中" : "低";
}

function getContextRelevanceTone(relevance: ContextSnapshot["selectedFiles"][number]["relevance"]): "green" | "blue" | "amber" {
  if (relevance === "high") {
    return "green";
  }

  if (relevance === "medium") {
    return "blue";
  }

  return "amber";
}

function getContextRelevanceLabel(relevance: ContextSnapshot["selectedFiles"][number]["relevance"]): string {
  if (relevance === "high") {
    return "高";
  }

  if (relevance === "medium") {
    return "中";
  }

  return "低";
}

function getPreviewBadgeTone(status: PreviewSession["status"] | undefined): "green" | "amber" | "red" | "blue" {
  if (status === "running") {
    return "green";
  }

  if (status === "failed") {
    return "red";
  }

  if (status === "starting") {
    return "blue";
  }

  return "amber";
}

function getPreviewStatusLabel(status: PreviewSession["status"] | undefined): string {
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

function getPatchLifecycleTone(status: PatchLifecycle["status"]): "green" | "amber" | "red" | "blue" {
  if (status === "applied") {
    return "green";
  }

  if (status === "precheck_failed" || status === "apply_failed" || status === "rejected") {
    return "red";
  }

  if (status === "generated") {
    return "blue";
  }

  return "amber";
}

function getPatchLifecycleLabel(status: PatchLifecycle["status"]): string {
  switch (status) {
    case "generated":
      return "已生成";
    case "precheck_failed":
      return "预检失败";
    case "awaiting_approval":
      return "等待审批";
    case "rejected":
      return "已拒绝";
    case "applied":
      return "已应用";
    case "apply_failed":
      return "应用失败";
    default:
      return status;
  }
}

function getPatchPrecheckLabel(status: PatchLifecycle["precheck"]["status"]): string {
  if (status === "passed") {
    return "通过";
  }

  if (status === "failed") {
    return "失败";
  }

  return "待执行";
}

function getPatchApplyLabel(status: PatchLifecycle["applyResult"] extends undefined ? never : NonNullable<PatchLifecycle["applyResult"]>["status"] | undefined): string {
  if (status === "applied") {
    return "已应用";
  }

  if (status === "failed") {
    return "失败";
  }

  return "未开始";
}

function getPatchLifecycleRiskLabel(lifecycle: PatchLifecycle | null): string {
  if (!lifecycle) {
    return "--";
  }

  if (lifecycle.status === "precheck_failed" || lifecycle.status === "apply_failed") {
    return "高";
  }

  if (lifecycle.status === "applied") {
    return "低";
  }

  return "中";
}

function getCommandRunTone(status: CommandRun["status"]): "green" | "amber" | "red" | "blue" {
  if (status === "passed") {
    return "green";
  }

  if (status === "failed" || status === "cancelled") {
    return "red";
  }

  if (status === "running") {
    return "blue";
  }

  return "amber";
}

function getCommandRunLabel(status: CommandRun["status"]): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "执行中";
    case "passed":
      return "通过";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
}

function getCommandRunIcon(status: CommandRun["status"]): string {
  if (status === "passed") {
    return "✓";
  }

  if (status === "failed" || status === "cancelled") {
    return "!";
  }

  if (status === "running") {
    return ">";
  }

  return "-";
}

function getCommandRunSummary(commandRun: CommandRun): string {
  const parts = [getCommandRunLabel(commandRun.status)];

  if (typeof commandRun.exitCode === "number") {
    parts.push(`退出码 ${commandRun.exitCode}`);
  }

  if (commandRun.startedAt) {
    parts.push(`开始 ${formatClock(commandRun.startedAt)}`);
  }

  if (commandRun.completedAt) {
    parts.push(`完成 ${formatClock(commandRun.completedAt)}`);
  }

  return parts.join(" · ");
}

function getTaskStageLabel(stage: Task["stage"]): string {
  switch (stage) {
    case "artifact_generation":
      return "生成中";
    case "patch_approval":
      return "等待补丁审批";
    case "verification":
      return "命令验证";
    case "failure_review":
      return "失败复盘";
    case "completed":
      return "已完成";
    default:
      return "生成中";
  }
}

function renderArtifactPreview(artifact: Artifact) {
  if (artifact.kind === "patch" || artifact.kind === "test_log") {
    return (
      <>
        <h3>{artifact.title}</h3>
        <pre>{artifact.content}</pre>
      </>
    );
  }

  const lines = artifact.content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const summary = lines[0] ?? "实现受控登录页面，包含邮箱和密码输入、客户端校验、接口错误提示，以及无效凭证回归测试。";
  const points = lines.slice(1, 5);

  return (
    <div className="artifact">
      <h4>{artifact.title}</h4>
      <p>{summary}</p>
      <ul className="list">
        {(points.length > 0 ? points : [
          "新增可访问的登录表单组件。",
          "接入现有认证客户端。",
          "补充空字段和登录失败测试。",
          "应用补丁后运行类型检查、Lint 和测试。",
        ]).map((point) => (
          <li key={point}><span className="check">✓</span>{point.replace(/^\d+\.\s*/, "")}</li>
        ))}
      </ul>
    </div>
  );
}

async function loadDashboardData({
  api,
  fallbackTask,
  preferredTaskId,
  setApiOnline,
  setApprovals,
  setAuditEvents,
  setLoadState,
  setSelectedTaskId,
  setTasks,
  setWorkspaces,
  shouldApply,
}: {
  api: AgentFlowApiClient;
  fallbackTask: Task | null;
  preferredTaskId: string | null;
  setApiOnline: (online: boolean) => void;
  setApprovals: (approvals: Approval[]) => void;
  setAuditEvents: (events: AuditEvent[]) => void;
  setLoadState: (state: LoadState) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setTasks: (tasks: Task[]) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  shouldApply: () => boolean;
}) {
  setLoadState("loading");

  try {
    const [loadedTasks, loadedWorkspaces, loadedApprovals, loadedAuditEvents] = await Promise.all([
      api.listTasks(),
      api.listWorkspaces(),
      api.listApprovals(),
      api.listAuditEvents(),
    ]);

    if (!shouldApply()) {
      return;
    }

    setTasks(loadedTasks);
    setWorkspaces(loadedWorkspaces);
    setApprovals(loadedApprovals);
    setAuditEvents(loadedAuditEvents);
    setSelectedTaskId(
      loadedTasks.some((task) => task.id === preferredTaskId)
        ? preferredTaskId
        : (loadedTasks[0]?.id as string | undefined) ?? null,
    );
    setApiOnline(true);
  } catch {
    if (!shouldApply()) {
      return;
    }

    const offlineTask = fallbackTask ?? demoTask;
    setTasks([offlineTask]);
    setWorkspaces(demoWorkspaces);
    setApprovals(demoApprovals);
    setAuditEvents(demoAuditEvents);
    setSelectedTaskId(offlineTask.id);
    setApiOnline(false);
    setLoadState("error");
    return;
  } finally {
    if (shouldApply()) {
      setLoadState("idle");
    }
  }
}

async function loadTaskDetails({
  api,
  setApiOnline,
  setApprovals,
  setArtifacts,
  setAuditEvents,
  setCommandRuns,
  setContextSnapshot,
  setEvents,
  setPatchLifecycle,
  setPreviewSession,
  setSelectedArtifactId,
  setTaskSource,
  taskId,
}: {
  api: AgentFlowApiClient;
  setApiOnline: (online: boolean) => void;
  setApprovals: (approvals: Approval[]) => void;
  setArtifacts: (artifacts: Artifact[]) => void;
  setAuditEvents: (events: AuditEvent[]) => void;
  setCommandRuns: (commandRuns: CommandRun[]) => void;
  setContextSnapshot: (snapshot: ContextSnapshot | null) => void;
  setEvents: (events: AgentFlowEvent[]) => void;
  setPatchLifecycle: (lifecycle: PatchLifecycle | null) => void;
  setPreviewSession: (previewSession: PreviewSession | null) => void;
  setSelectedArtifactId: (artifactId: string | null) => void;
  setTaskSource: (source: TaskSource | null) => void;
  taskId: string;
}) {
  try {
    const [loadedTaskDetails, loadedContextSnapshot, loadedPatchLifecycle, loadedCommandRuns, loadedPreviewSession] = await Promise.all([
      Promise.all([
        api.listEvents(taskId),
        api.listArtifacts(taskId),
        api.listApprovals(taskId),
        api.listAuditEvents(taskId),
        api.getTaskSource(taskId),
      ]),
      api.getTaskContext(taskId).catch(() => null),
      api.getPatchLifecycle(taskId).catch(() => null),
      api.getCommandRuns(taskId).catch(() => []),
      api.getPreviewSession(taskId).catch(() => null),
    ]);
    const [loadedEvents, loadedArtifacts, loadedApprovals, loadedAuditEvents, loadedTaskSource] = loadedTaskDetails;
    setEvents(loadedEvents);
    setArtifacts(loadedArtifacts);
    setApprovals(loadedApprovals);
    setAuditEvents(loadedAuditEvents);
    setTaskSource(loadedTaskSource);
    setContextSnapshot(loadedContextSnapshot);
    setPatchLifecycle(loadedPatchLifecycle);
    setCommandRuns(loadedCommandRuns);
    setPreviewSession(loadedPreviewSession);
    setSelectedArtifactId((loadedArtifacts[0]?.id as string | undefined) ?? null);
    setApiOnline(true);
  } catch {
    setEvents(demoEvents);
    setArtifacts(demoArtifacts);
    setApprovals(demoApprovals);
    setAuditEvents(demoAuditEvents);
    setTaskSource(demoTaskSource);
    setContextSnapshot(demoContextSnapshot);
    setPatchLifecycle(demoPatchLifecycle);
    setCommandRuns(demoCommandRuns);
    setPreviewSession(demoPreviewSession);
    setSelectedArtifactId(demoArtifacts[0]?.id ?? null);
    setApiOnline(false);
  }
}

function getCurrentViewCopy(view: ViewKey, taskMode: TaskMode, selectedTask: Task | null) {
  if (view !== "tasks") {
    return viewCopy[view];
  }

  if (taskMode === "create") {
    return {
      title: "创建开发任务",
      description: "任务来源可以不同，但最终都会转换成统一的 Development Task。",
    };
  }

  if (taskMode === "detail" && selectedTask) {
    const statusLabel =
      isWaitingForApproval(selectedTask.status)
        ? "等待审批"
        : selectedTask.status === "failed"
          ? "执行失败"
          : "运行中";

    return {
      title: selectedTask.title,
      description: `任务 ${selectedTask.id.slice(0, 8)} · ${statusLabel} · 当前阶段：${getTaskStageLabel(selectedTask.stage)}`,
    };
  }

  return viewCopy.tasks;
}

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getCurrentBrandCopy(view: ViewKey, taskMode: TaskMode, apiOnline: boolean, workspace: Workspace) {
  if (view === "workspace") {
    return {
      subtitle: "工作区驱动开发",
      runnerTitle: "V0 模式",
      runnerText: apiOnline ? `当前工作区：${workspace.name}，Runner 状态 ${workspace.status}。` : "当前展示模拟连接状态，不会读取或修改本地文件。",
    };
  }

  if (view === "tasks" && taskMode === "create") {
    return {
      subtitle: "需求到开发任务",
      runnerTitle: "本地 Runner",
      runnerText: apiOnline ? `已连接到 ${workspace.name}。` : "API 未连接，当前显示本地示例数据。",
    };
  }

  return {
    subtitle: "多 Agent 开发流程",
    runnerTitle: "本地 Runner",
    runnerText: apiOnline ? `已连接到 ${workspace.name}。` : "API 未连接，当前显示本地示例数据。",
  };
}
