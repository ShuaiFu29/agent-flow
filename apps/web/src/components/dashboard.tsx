"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
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
import { demoArtifacts, demoEvents, demoTask } from "../lib/demo-data";
import { getTaskStatusLabel, getTaskStatusTone, isWaitingForApproval } from "../lib/task-status";
import { resolveWorkspacePresentation } from "../lib/workspaces";
import { Logo } from "./logo";

type LoadState = "idle" | "loading" | "error";
type ViewKey = "tasks" | "workspace" | "artifacts" | "approvals" | "audit" | "settings";
type TaskMode = "overview" | "detail" | "create";

const agentLabels: Record<AgentRole, string> = {
  planner: "è§„åˆ’",
  context: "ä¸Šä¸‹æ–‡",
  coder: "ç¼–ç ",
  reviewer: "å®¡æŸ¥",
  tester: "æµ‹è¯•",
  summary: "æ€»ç»“",
};

const artifactLabels: Record<Artifact["kind"], string> = {
  final_report: "æ€»ç»“",
  patch: "è¡¥ä¸",
  plan: "è®¡åˆ’",
  review: "å®¡æŸ¥",
  test_log: "æµ‹è¯•æ—¥å¿—",
  workspace_summary: "å·¥ä½œåŒº",
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
  name: "æœªè¿žæŽ¥å·¥ä½œåŒº",
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
  title: "å¢žåŠ é‚®ç®±ç™»å½•æµç¨‹",
  content: "ç”¨æˆ·åœ¨ Web ç«¯é€‰æ‹©å·¥ä½œåŒºåŽè¾“å…¥å¼€å‘éœ€æ±‚ï¼Œç”± Agent åä½œå®Œæˆæ–¹æ¡ˆã€è¡¥ä¸ã€å®¡æŸ¥ã€æµ‹è¯•å’ŒæŠ¥å‘Šã€‚",
  createdAt: "2026-06-23T00:00:00.000Z",
};

const demoContextSnapshot: ContextSnapshot = {
  id: "snapshot_demo",
  taskId: demoTask.id,
  selectedFiles: [
    { path: "apps/web/app/login/page.tsx", reason: "ç™»å½•é¡µé¢å…¥å£", relevance: "high" },
    { path: "apps/web/src/components/auth-form.tsx", reason: "è¡¨å•ç»„ä»¶", relevance: "medium" },
    { path: "packages/shared/src/domain.ts", reason: "å…±äº«ä»»åŠ¡æ¨¡åž‹", relevance: "medium" },
  ],
  rejectedFiles: [
    { path: ".env.local", reason: "åŒ…å«æœ¬åœ°å¯†é’¥ï¼Œä¸è¿›å…¥ Agent ä¸Šä¸‹æ–‡" },
    { path: "node_modules", reason: "ä¾èµ–ç›®å½•è¿‡å¤§ä¸”æ— éœ€ç´¢å¼•" },
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
  audit("user", "task_created", "ç”¨æˆ·åˆ›å»ºä»»åŠ¡å¹¶ç»‘å®š demo-app å·¥ä½œåŒº"),
  audit("agent", "context_snapshot_created", "ä¸Šä¸‹æ–‡ Agent é€‰æ‹© 3 ä¸ªæ–‡ä»¶ï¼ŒæŽ’é™¤ 2 ä¸ªæ•æ„Ÿæˆ–æ— å…³è·¯å¾„"),
  audit("agent", "patch_created", "ç¼–ç  Agent ç”Ÿæˆ patch äº§ç‰©"),
  audit("runner", "command_completed", "pnpm test passed"),
  audit("user", "approval_requested", "ç­‰å¾…ç”¨æˆ·å®¡æ‰¹ patch"),
];

const navItems: Array<{
  key: ViewKey;
  label: string;
  testId: string;
}> = [
  { key: "tasks", label: "ä»»åŠ¡", testId: "nav-tasks" },
  { key: "workspace", label: "å·¥ä½œåŒº", testId: "nav-workspace" },
  { key: "artifacts", label: "äº§ç‰©", testId: "nav-artifacts" },
  { key: "approvals", label: "å®¡æ‰¹", testId: "nav-approvals" },
  { key: "audit", label: "å®¡è®¡", testId: "nav-audit" },
  { key: "settings", label: "è®¾ç½®", testId: "nav-settings" },
];

const viewCopy: Record<ViewKey, { title: string; description: string }> = {
  tasks: {
    title: "å¼€å‘ä»»åŠ¡å·¥ä½œå°",
    description: "åˆ›å»ºä»»åŠ¡ã€è§‚å¯Ÿ Agent åä½œã€å®¡æ‰¹è¡¥ä¸å¹¶æŸ¥çœ‹æµ‹è¯•ç»“æžœ",
  },
  workspace: {
    title: "é€‰æ‹©å·¥ä½œåŒº",
    description: "Agent ä»»åŠ¡å¿…é¡»ç»‘å®šåˆ°ä¸€ä¸ªå·¥ä½œåŒºï¼ŒåŽç»­ä¸Šä¸‹æ–‡ã€è¡¥ä¸å’Œæµ‹è¯•éƒ½å›´ç»•å®ƒå±•å¼€ã€‚",
  },
  artifacts: {
    title: "äº§ç‰©ä¸­å¿ƒ",
    description: "æŒ‰ä»»åŠ¡ã€Agent å’Œäº§ç‰©ç±»åž‹ç­›é€‰åŽ†å²è¾“å‡º",
  },
  approvals: {
    title: "å®¡æ‰¹ä¸­å¿ƒ",
    description: "æ‰€æœ‰æœ¬åœ°å†™å…¥å’Œæ•æ„Ÿæ‰§è¡Œéƒ½å¿…é¡»æ˜¾å¼ç¡®è®¤",
  },
  audit: {
    title: "å®¡è®¡æ—¥å¿—",
    description: "å¤ç›˜ AI å¼€å‘è¿‡ç¨‹ä¸­çš„æ¯ä¸€æ¬¡å†³ç­–å’Œæœ¬åœ°æ“ä½œ",
  },
  settings: {
    title: "è®¾ç½®",
    description: "é…ç½® agent-flow çš„æ¨¡åž‹ã€æµç¨‹å’Œæœ¬åœ°æ‰§è¡Œå®‰å…¨ç­–ç•¥",
  },
};

export function Dashboard() {
  const [api] = useState(() => createApiClient());
  const [activeView, setActiveView] = useState<ViewKey>("tasks");
  const [taskMode, setTaskMode] = useState<TaskMode>("overview");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentFlowEvent[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [taskSource, setTaskSource] = useState<TaskSource | null>(null);
  const [contextSnapshot, setContextSnapshot] = useState<ContextSnapshot | null>(null);
  const [patchLifecycle, setPatchLifecycle] = useState<PatchLifecycle | null>(null);
  const [commandRuns, setCommandRuns] = useState<CommandRun[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState(true);
  const [formTitle, setFormTitle] = useState("å¢žåŠ é‚®ç®±ç™»å½•æµç¨‹");
  const [formPrompt, setFormPrompt] = useState("åœ¨çŽ°æœ‰é¡¹ç›®ä¸­å¢žåŠ ç™»å½•é¡µé¢ï¼Œæ”¯æŒé‚®ç®±å’Œå¯†ç ç™»å½•ã€‚");

  useEffect(() => {
    void loadDashboardData({
      api,
      setApiOnline,
      setApprovals,
      setAuditEvents,
      setLoadState,
      setSelectedTaskId,
      setTasks,
      setWorkspaces,
    });
  }, [api]);

  useEffect(() => {
    if (!selectedTaskId) {
      setEvents([]);
      setArtifacts([]);
      setTaskSource(null);
      setContextSnapshot(null);
      setPatchLifecycle(null);
      setCommandRuns([]);
      setSelectedArtifactId(null);
      return;
    }

    setContextSnapshot(null);
    setPatchLifecycle(null);
    setCommandRuns([]);
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
  const displaySelectedTask = selectedTask ?? displayTasks[0] ?? null;
  const displaySelectedTaskId = selectedTaskId ?? displaySelectedTask?.id ?? null;
  const selectedArtifact = useMemo(
    () => displayArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? displayArtifacts[0] ?? null,
    [displayArtifacts, selectedArtifactId],
  );

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadState("loading");

    try {
      const task = await api.createTask({ title: formTitle, prompt: formPrompt });
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
      setTaskMode("detail");
      setApiOnline(true);
    } catch {
      const task = { ...demoTask, title: formTitle, prompt: formPrompt };
      setTasks([task]);
      setWorkspaces(demoWorkspaces);
      setSelectedTaskId(task.id);
      setTaskMode("detail");
      setEvents(demoEvents);
      setArtifacts(demoArtifacts);
      setApprovals(demoApprovals);
      setAuditEvents(demoAuditEvents);
      setTaskSource({ ...demoTaskSource, title: formTitle, content: formPrompt });
      setContextSnapshot(demoContextSnapshot);
      setPatchLifecycle(demoPatchLifecycle);
      setCommandRuns(demoCommandRuns);
      setSelectedArtifactId(demoArtifacts[0]?.id ?? null);
      setApiOnline(false);
    } finally {
      setLoadState("idle");
    }
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
      setTaskMode("detail");
      setApiOnline(true);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : "å®¡æ‰¹æ‰§è¡Œå¤±è´¥ï¼Œè¯·ç¨åŽé‡è¯•ã€‚");
    } finally {
      setApprovalActionId(null);
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
        <nav className="nav" aria-label="ä¸»å¯¼èˆª">
          {navItems.map((item) => (
            <button
              className={`nav-item ${activeView === item.key ? "active" : ""}`}
              data-testid={item.testId}
              key={item.key}
              onClick={() => {
                setActiveView(item.key);
                if (item.key === "tasks") {
                  setTaskMode("overview");
                }
              }}
              type="button"
            >
              <span className="dot" />
              {item.label}
            </button>
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
              onCreateTask={() => setTaskMode("create")}
              onOpenApprovals={() => setActiveView("approvals")}
              onRefresh={() =>
                void loadDashboardData({
                  api,
                  setApiOnline,
                  setApprovals,
                  setAuditEvents,
                  setLoadState,
                  setSelectedTaskId,
                  setTasks,
                  setWorkspaces,
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
            artifacts={displayArtifacts}
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
            completedEvents={completedEvents}
            disabled={loadState === "loading"}
            events={displayEvents}
            formPrompt={formPrompt}
            formTitle={formTitle}
            onApproveApproval={(approval) => void handleApprovalDecision(approval, "approve")}
            onArtifactSelect={setSelectedArtifactId}
            onPromptChange={setFormPrompt}
            onRejectApproval={(approval) => void handleApprovalDecision(approval, "reject")}
            onSelectTask={setSelectedTaskId}
            onSubmit={handleCreateTask}
            onSwitchMode={setTaskMode}
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
  completedEvents,
  disabled,
  events,
  formPrompt,
  formTitle,
  onApproveApproval,
  onArtifactSelect,
  onPromptChange,
  onRejectApproval,
  onSelectTask,
  onSubmit,
  onSwitchMode,
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
  completedEvents: number;
  disabled: boolean;
  events: AgentFlowEvent[];
  formPrompt: string;
  formTitle: string;
  onApproveApproval: (approval: Approval) => void;
  onArtifactSelect: (artifactId: string) => void;
  onPromptChange: (value: string) => void;
  onRejectApproval: (approval: Approval) => void;
  onSelectTask: (taskId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSwitchMode: (mode: TaskMode) => void;
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
          events={events}
          onApproveApproval={onApproveApproval}
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
            <div className="notice">API æœªè¿žæŽ¥ï¼Œå½“å‰æ˜¾ç¤ºç¤ºä¾‹æ•°æ®ï¼Œå¯ç»§ç»­é¢„è§ˆ V0 é¡µé¢æµç¨‹ã€‚</div>
          </div>
        </section>
      ) : null}
      {isEmptyState ? (
        <section className="panel">
          <div className="panel-head">
            <h4>æš‚æ— ä»»åŠ¡</h4>
            <span className="badge">ç©ºçŠ¶æ€</span>
          </div>
          <div className="panel-body">
            <div className="notice">å…ˆé€‰æ‹©å·¥ä½œåŒºå¹¶åˆ›å»ºä¸€ä¸ªå¼€å‘ä»»åŠ¡ï¼ŒAgent ç»“æžœä¼šåœ¨è¿™é‡Œæ±‡æ€»å±•ç¤ºã€‚</div>
          </div>
        </section>
      ) : (
        <div className="grid-3">
          <TaskList
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelect={(taskId) => {
              onSelectTask(taskId);
              onSwitchMode("detail");
            }}
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
          <span className={`tag ${pendingApprovalCount > 0 ? "amber" : "blue"}`}>{pendingApprovalCount > 0 ? "å¾…å®¡æ‰¹" : "å·²å®Œæˆ"}</span>
          <button className="btn secondary" onClick={onOpenApprovals} type="button">å‰å¾€å®¡æ‰¹</button>
        </>
      );
    }

    if (taskMode === "create") {
      return (
        <>
          <span className="tag green">{selectedWorkspaceName}</span>
          <button className="btn" type="submit" form="task-create-form">åˆ›å»ºä»»åŠ¡</button>
        </>
      );
    }

    return (
        <>
          <span className={`tag ${apiOnline ? "green" : "amber"}`}>{apiOnline ? "Runner åœ¨çº¿" : "ç¤ºä¾‹æ¨¡å¼"}</span>
          <span className="tag amber">{pendingApprovalCount} ä¸ªå¾…å®¡æ‰¹</span>
          <button className="btn" data-testid="create-task-view-button" onClick={onCreateTask} type="button">æ–°å»ºä»»åŠ¡</button>
        </>
      );
  }

  if (view === "workspace") {
    return (
      <>
        <button className="btn secondary" onClick={onRefresh} type="button">åˆ·æ–°çŠ¶æ€</button>
        <button className="btn" type="button">è¿žæŽ¥å·¥ä½œåŒº</button>
      </>
    );
  }

  if (view === "artifacts") {
    return <button className="btn secondary" type="button">å¯¼å‡º</button>;
  }

  if (view === "approvals") {
    return <span className="tag amber">{pendingApprovalCount} ä¸ªå¾…å®¡æ‰¹</span>;
  }

  if (view === "audit") {
    return <button className="btn secondary" type="button">å¯¼å‡ºæ—¥å¿—</button>;
  }

  return <button className="btn" type="button">ä¿å­˜è®¾ç½®</button>;
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
          <div className="panel-head"><h4>æœ€è¿‘å·¥ä½œåŒº</h4><span className="badge">0 åœ¨çº¿</span></div>
          <div className="panel-body">
            <div className="notice">å½“å‰è¿˜æ²¡æœ‰å·²æ³¨å†Œçš„æœ¬åœ°å·¥ä½œåŒºã€‚å…ˆå¯åŠ¨ local runnerï¼Œå†å›žæ¥é€‰æ‹©å·¥ä½œåŒºã€‚</div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h4>å½“å‰èƒ½åŠ›</h4><span className="badge blue">V1 é˜¶æ®µ A</span></div>
          <div className="panel-body split-list">
            <div className="policy"><strong>çœŸå®žæ³¨å†Œ</strong><p>å·¥ä½œåŒºæ¥è‡ªçœŸå®ž runner æ³¨å†Œï¼Œè€Œä¸æ˜¯ç¤ºä¾‹ seedã€‚</p></div>
            <div className="policy"><strong>åœ¨çº¿çŠ¶æ€</strong><p>é€šè¿‡ heartbeat ç»´æŠ¤ runner åœ¨çº¿/ç¦»çº¿çŠ¶æ€ã€‚</p></div>
            <div className="policy"><strong>çœŸå®žæŽ§åˆ¶å°</strong><p>Web åªå±•ç¤º API è¿”å›žçš„å·¥ä½œåŒºæ•°æ®ã€‚</p></div>
            <div className="policy"><strong>æ‰§è¡Œè¾¹ç•Œ</strong><p>patch å’Œå‘½ä»¤æ‰§è¡Œä¼šåœ¨åŽç»­é˜¶æ®µæŽ¥å…¥ã€‚</p></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h4>ä¸‹ä¸€æ­¥</h4><span className="badge amber">éœ€è¦è¿žæŽ¥</span></div>
          <div className="panel-body">
            <div className="notice">å…ˆè¿è¡Œ agent-flow connect å‘½ä»¤å¹¶ä¼ å…¥ workspace è·¯å¾„å’Œ API åœ°å€ï¼Œè®©æœ¬åœ°é¡¹ç›®æ³¨å†Œåˆ°æŽ§åˆ¶å°ã€‚</div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="grid-3">
        <section className="panel" data-testid="workspace-summary">
          <div className="panel-head"><h4>æœ€è¿‘å·¥ä½œåŒº</h4><span className="badge green">{onlineCount} åœ¨çº¿</span></div>
          <div className="panel-body">
            <ul className="list">
              {workspaces.map((workspace) => (
                <li key={workspace.id}>
                  <span className={workspace.status === "online" ? "check" : "dot"}>
                    {workspace.status === "online" ? "âœ“" : ""}
                  </span>
                  <div>
                    <strong>{workspace.name}</strong>
                    <div className="desc">
                      {workspace.rootPath} Â· {workspace.status === "online" ? "Runner åœ¨çº¿" : workspace.status === "error" ? "è¿žæŽ¥å¼‚å¸¸" : "æœªè¿žæŽ¥"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h4>å½“å‰èƒ½åŠ›</h4><span className="badge blue">éª¨æž¶ç‰ˆ</span></div>
          <div className="panel-body split-list">
            <div className="policy"><strong>å¯åˆ›å»ºä»»åŠ¡</strong><p>éœ€æ±‚ä¼šç»‘å®šåˆ°å½“å‰å·¥ä½œåŒºã€‚</p></div>
            <div className="policy"><strong>å¯å±•ç¤ºäº§ç‰©</strong><p>è®¡åˆ’ã€è¡¥ä¸ã€å®¡æŸ¥ã€æµ‹è¯•æŠ¥å‘Šã€‚</p></div>
            <div className="policy"><strong>æ¨¡æ‹Ÿ Runner</strong><p>V0 ä¸æ‰§è¡ŒçœŸå®žå‘½ä»¤ã€‚</p></div>
            <div className="policy"><strong>å®‰å…¨è¾¹ç•Œ</strong><p>æœ¬åœ°æ“ä½œç•™åˆ° V2ã€‚</p></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h4>ä¸‹ä¸€æ­¥</h4><span className="badge amber">éœ€è¦é€‰æ‹©</span></div>
          <div className="panel-body">
            <div className="notice">
              {!apiOnline
                ? "API æœªè¿žæŽ¥ï¼Œå½“å‰æ˜¾ç¤ºç¤ºä¾‹å·¥ä½œåŒºã€‚æ¢å¤è¿žæŽ¥åŽå¯ä»¥ç»‘å®šçœŸå®žå·¥ä½œåŒºã€‚"
                : selectedWorkspace.status === "error"
                  ? "å½“å‰å·¥ä½œåŒºè¿žæŽ¥å¼‚å¸¸ï¼Œè¯·å…ˆæ¢å¤ Runner å†å‘èµ·ä»»åŠ¡ã€‚"
                  : "é€‰æ‹©å·¥ä½œåŒºåŽï¼Œç”¨æˆ·å¯ä»¥è¾“å…¥å¼€å‘éœ€æ±‚ã€Bug æè¿°æˆ–é”™è¯¯æ—¥å¿—ï¼Œè®© Agent åŸºäºŽè¯¥å·¥ä½œåŒºç”Ÿæˆè®¡åˆ’å’Œè¡¥ä¸ã€‚"}
            </div>
            <div style={{ height: 12 }} />
            <button className="btn" type="button">åŸºäºŽ {selectedWorkspace.name} æ–°å»ºä»»åŠ¡</button>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h4>å·¥ä½œåŒºå®¡è®¡æ‘˜è¦</h4><span className="badge">æœ€è¿‘äº‹ä»¶</span></div>
        <table>
          <thead><tr><th>æ—¶é—´</th><th>æ¥æº</th><th>äº‹ä»¶</th><th>ç»“æžœ</th></tr></thead>
          <tbody>
            {workspaces.slice(0, 3).map((workspace, index) => (
              <tr key={workspace.id}>
                <td>{index === 0 ? "åˆšåˆš" : `${index + 1} åˆ†é’Ÿå‰`}</td>
                <td>{index === 0 ? "Runner" : index === 1 ? "ç”¨æˆ·" : "ç³»ç»Ÿ"}</td>
                <td>{index === 0 ? `åŒæ­¥ ${workspace.name} çŠ¶æ€` : index === 1 ? `é€‰æ‹© ${workspace.name}` : `åŠ è½½ ${workspace.name}`}</td>
                <td>
                  <span className={`badge ${workspace.status === "online" ? "green" : workspace.status === "error" ? "red" : "blue"}`}>
                    {workspace.status === "online" ? "åœ¨çº¿" : workspace.status === "error" ? "å¼‚å¸¸" : "å·²è®°å½•"}
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
  artifacts,
  source,
}: {
  artifacts: Artifact[];
  source: TaskSource;
}) {
  const artifactRows = artifacts.length > 0 ? artifacts.slice(0, 3) : demoArtifacts.slice(0, 3);
  const previewArtifact = artifactRows[0] ?? null;

  return (
    <div className="grid-main-side">
      <section className="panel">
        <div className="panel-head">
          <h4>äº§ç‰©åˆ—è¡¨</h4>
          <span className="badge">{artifactRows.length} æ¡</span>
        </div>
        <table>
          <thead>
            <tr><th>äº§ç‰©</th><th>ç±»åž‹</th><th>ä»»åŠ¡</th><th>Agent</th><th>æ—¶é—´</th></tr>
          </thead>
          <tbody>
            {artifactRows.map((artifact, index) => (
              <tr key={artifact.id}>
                <td>
                  <div className="title">{index === 1 ? "patch.diff" : artifact.title}</div>
                  <div className="desc">
                    {index === 0 ? "ç™»å½•æµç¨‹æ‹†è§£" : index === 1 ? "4 ä¸ªæ–‡ä»¶å˜æ›´" : "æ— é˜»å¡žé—®é¢˜"}
                  </div>
                </td>
                <td>{index === 0 ? "Plan" : index === 1 ? "Patch" : "Review"}</td>
                <td>{source.title}</td>
                <td>{index === 0 ? "è§„åˆ’" : index === 1 ? "ç¼–ç " : "å®¡æŸ¥"}</td>
                <td>{index === 0 ? "2 åˆ†é’Ÿå‰" : index === 1 ? "1 åˆ†é’Ÿå‰" : "åˆšåˆš"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h4>é¢„è§ˆ</h4>
          <span className="badge blue">{previewArtifact ? artifactLabels[previewArtifact.kind] : "Plan"}</span>
        </div>
        <div className="artifact">
          <h4>{previewArtifact?.title ?? "å®žçŽ°è®¡åˆ’"}</h4>
          <p>ç›®æ ‡æ˜¯æ–°å¢žç™»å½•é¡µé¢å¹¶æŽ¥å…¥çŽ°æœ‰è®¤è¯å®¢æˆ·ç«¯ã€‚æ‰€æœ‰å†™å…¥å¿…é¡»ç»è¿‡è¡¥ä¸å®¡æ‰¹ï¼Œåº”ç”¨åŽè¿è¡Œ typecheckã€lint å’Œ testã€‚</p>
          <ul className="list">
            <li><span className="check">âœ“</span>æ–°å¢žè¡¨å•ç»„ä»¶</li>
            <li><span className="check">âœ“</span>æŽ¥å…¥è®¤è¯å®¢æˆ·ç«¯</li>
            <li><span className="check">âœ“</span>è¡¥å……æµ‹è¯•</li>
          </ul>
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
        <h4>å¾…å¤„ç†å®¡æ‰¹</h4>
        <span className="badge amber">{pendingCount > 0 ? "éœ€è¦ç¡®è®¤" : "ç­‰å¾…è¡¥ä¸"}</span>
      </div>
      {approvalError ? (
        <div className="panel-body">
          <div className="notice">{approvalError}</div>
        </div>
      ) : null}
      <table>
        <thead>
          <tr><th>æ“ä½œ</th><th>ä»»åŠ¡</th><th>å·¥ä½œåŒº</th><th>é£Žé™©</th><th>çŠ¶æ€</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <div className="notice">å½“å‰æ²¡æœ‰å¾…å¤„ç†å®¡æ‰¹ï¼Œæ–°çš„è¡¥ä¸æˆ–å‘½ä»¤ç”³è¯·ä¼šå‡ºçŽ°åœ¨è¿™é‡Œã€‚</div>
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
                      {actionApprovalId === approval.id ? "å¤„ç†ä¸­" : "æ‰¹å‡†"}
                    </button>
                    <button
                      className="btn secondary"
                      data-testid={`reject-${approval.id}`}
                      disabled={!apiOnline || actionApprovalId === approval.id}
                      onClick={() => onReject(approval)}
                      type="button"
                    >
                      æ‹’ç»
                    </button>
                  </div>
                ) : (
                  <span className={`badge ${approval.status === "approved" ? "green" : "red"}`}>
                    {approval.status === "approved" ? "å·²æ‰¹å‡†" : "å·²æ‹’ç»"}
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
        <h4>äº‹ä»¶æµ</h4>
        <span className="badge">ä»Šå¤©</span>
      </div>
      <table>
        <thead>
          <tr><th>æ—¶é—´</th><th>æ¥æº</th><th>äº‹ä»¶</th><th>ç»“æžœ</th></tr>
        </thead>
        <tbody>
          {!apiOnline ? (
            <tr>
              <td colSpan={4}>
                <div className="notice">API æœªè¿žæŽ¥ï¼Œå½“å‰æ˜¾ç¤ºç¤ºä¾‹å®¡è®¡è®°å½•ã€‚</div>
              </td>
            </tr>
          ) : null}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>
                <div className="notice">å½“å‰è¿˜æ²¡æœ‰å®¡è®¡è®°å½•ï¼Œä»»åŠ¡å¼€å§‹åŽä¼šè‡ªåŠ¨å†™å…¥ã€‚</div>
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
                  {event.action.includes("failed") ? "å¤±è´¥" : event.action.includes("approval") ? "å¾…å¤„ç†" : "æˆåŠŸ"}
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
          <h4>æ¨¡åž‹é…ç½®</h4>
          <span className="badge green">å¯ç”¨</span>
        </div>
        <div className="panel-body form">
          <label className="field">
            <span>æ¨¡åž‹ä¾›åº”å•†</span>
            <div className="select">OpenAI-compatible Provider</div>
          </label>
          <label className="field">
            <span>é»˜è®¤æ¨¡åž‹</span>
            <input className="input" readOnly value="gpt-4.1" />
          </label>
          <label className="field">
            <span>ç»“æž„åŒ–è¾“å‡ºæ ¡éªŒ</span>
            <div className="select">å¼€å¯ï¼Œå¤±è´¥æ—¶é‡è¯• 1 æ¬¡</div>
          </label>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h4>å®‰å…¨é»˜è®¤å€¼</h4>
          <span className="badge blue">æŽ¨è</span>
        </div>
        <div className="panel-body split-list">
          <div className="policy"><strong>å†™å…¥å®¡æ‰¹</strong><p>æ‰€æœ‰ patch å¿…é¡»æ‰‹åŠ¨å®¡æ‰¹ã€‚</p></div>
          <div className="policy"><strong>å‘½ä»¤ç™½åå•</strong><p>åªå…è®¸æµ‹è¯•ã€Lintã€ç±»åž‹æ£€æŸ¥ã€‚</p></div>
          <div className="policy"><strong>æ•æ„Ÿæ–‡ä»¶</strong><p>é»˜è®¤æ‹’ç» .envã€å¯†é’¥ã€è¯ä¹¦ã€‚</p></div>
          <div className="policy"><strong>å®¡è®¡æ—¥å¿—</strong><p>ä¿ç•™æ‰€æœ‰ä»»åŠ¡äº‹ä»¶å’Œæœ¬åœ°å‘½ä»¤ã€‚</p></div>
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
        <h4>è¿›è¡Œä¸­çš„ä»»åŠ¡</h4>
        <span className="badge blue">{tasks.length} ä¸ªä»»åŠ¡</span>
      </div>
      <table>
        <thead>
          <tr><th>ä»»åŠ¡</th><th>é˜¶æ®µ</th><th>é£Žé™©</th><th>æ›´æ–°æ—¶é—´</th></tr>
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
              <td><span className="badge amber">ä¸­</span></td>
              <td>{formatClock(task.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
        <span>ä»»åŠ¡æ ‡é¢˜</span>
        <input className="input" data-testid="task-title-input" onChange={(event) => onTitleChange(event.target.value)} value={title} />
      </label>
      <label className="field">
        <span>å¼€å‘éœ€æ±‚</span>
        <textarea className="textarea" data-testid="task-prompt-input" onChange={(event) => onPromptChange(event.target.value)} value={prompt} />
      </label>
      <button className="btn" data-testid="task-submit-button" disabled={disabled || !title.trim() || !prompt.trim()} type="submit">
        å¯åŠ¨ä»»åŠ¡
      </button>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h4>ä»»åŠ¡å†…å®¹</h4>
        <span className="badge green">Runner å·²è¿žæŽ¥</span>
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
        <div className="panel-head"><h4>éœ€æ±‚å†…å®¹</h4><span className="badge green">æ‰‹åŠ¨è¾“å…¥</span></div>
        <div className="panel-body form">
          <div className="split-list">
            <div className="choice"><strong>æ‰‹åŠ¨éœ€æ±‚</strong><p>ç›´æŽ¥æè¿°è¦å¼€å‘çš„åŠŸèƒ½æˆ–ä¼˜åŒ–ã€‚</p></div>
            <div className="choice"><strong>é”™è¯¯æ—¥å¿—</strong><p>ç²˜è´´æŠ¥é”™ã€æµ‹è¯•å¤±è´¥æˆ–æŽ§åˆ¶å°æ—¥å¿—ã€‚</p></div>
            <div className="choice"><strong>éœ€æ±‚æ–‡æ¡£</strong><p>ä»Žæ–‡æ¡£æ‘˜å–ç›®æ ‡ã€çº¦æŸå’ŒéªŒæ”¶æ ‡å‡†ã€‚</p></div>
            <div className="choice"><strong>GitHub Issue</strong><p>V3 æ”¯æŒå¯¼å…¥ï¼Œä¸ä½œä¸ºä¸»å…¥å£ã€‚</p></div>
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
        <div className="panel-head"><h4>ä»»åŠ¡çº¦æŸ</h4><span className="badge amber">å®¡æ‰¹å‰ä¸å†™å…¥</span></div>
        <div className="panel-body">
          <div className="kv"><span>ç»‘å®šå·¥ä½œåŒº</span><strong>{workspace.name}</strong></div>
          <div className="kv"><span>å…è®¸èŒƒå›´</span><strong>src/app/login</strong></div>
          <div className="kv"><span>æ£€æŸ¥å‘½ä»¤</span><strong>pnpm test</strong></div>
          <div className="kv"><span>æ•æ„Ÿæ–‡ä»¶</span><strong>æ‹’ç»è¯»å–</strong></div>
          <div className="kv"><span>å†™å…¥ç­–ç•¥</span><strong>å…ˆç”Ÿæˆè¡¥ä¸</strong></div>
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
        <h4>è¿è¡Œæ¦‚å†µ</h4>
        <span className="badge green">{tasks.length > 0 ? "æ­£å¸¸" : "ç­‰å¾…ä»»åŠ¡"}</span>
      </div>
      <div className="panel-body">
        <div className="metric-grid">
          <div className="metric"><span>Agent</span><strong>{completedEvents}</strong></div>
          <div className="metric"><span>äº‹ä»¶</span><strong>{events.length}</strong></div>
          <div className="metric"><span>äº§ç‰©</span><strong>{artifacts.length}</strong></div>
        </div>
      </div>
    </section>
  );
}

function LatestArtifacts({ artifacts }: { artifacts: Artifact[] }) {
  const latest = artifacts.slice(0, 3);

  return (
    <section className="panel">
      <div className="panel-head"><h4>æœ€æ–°äº§ç‰©</h4><span className="badge">ä»Šå¤©</span></div>
      <div className="panel-body">
        {latest.length > 0 ? (
          <ul className="list">
            {latest.map((artifact) => (
              <li key={artifact.id}><span className="check">âœ“</span>{artifact.title}</li>
            ))}
          </ul>
        ) : (
          <div className="notice">ä»»åŠ¡å¼€å§‹åŽï¼Œè¿™é‡Œä¼šå±•ç¤ºæœ€æ–°ç”Ÿæˆçš„äº§ç‰©ã€‚</div>
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
    { role: "planner", status: eventMap.has("planner") ? "done" : "idle", note: "ç”Ÿæˆå®žçŽ°æ­¥éª¤å’ŒéªŒæ”¶æ ‡å‡†ã€‚" },
    { role: "context", status: hasWorkspaceSummary ? "done" : "idle", note: "ä»Žå·¥ä½œåŒºé€‰æ‹©ç›¸å…³æ–‡ä»¶å¹¶ç”Ÿæˆæ‘˜è¦ã€‚" },
    { role: "coder", status: eventMap.has("coder") ? "done" : "active", note: "ç”Ÿæˆç™»å½•è¡¨å•å’Œæµ‹è¯•è¡¥ä¸ã€‚" },
    { role: "reviewer", status: eventMap.has("reviewer") ? "done" : "wait", note: "ç­‰å¾…æ£€æŸ¥è¡¥ä¸é£Žé™©ã€‚" },
    { role: "tester", status: eventMap.has("tester") ? "done" : "idle", note: "å®¡æ‰¹åŽåˆ†æžæµ‹è¯•æ—¥å¿—ã€‚" },
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <h4>åä½œæ—¶é—´çº¿</h4>
        <span className="badge blue">è¿è¡Œä¸­</span>
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
          <div className="notice">æš‚æ— äº§ç‰©ã€‚</div>
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
  onApproveApproval,
  onRejectApproval,
  patchLifecycle,
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
  onApproveApproval: (approval: Approval) => void;
  onRejectApproval: (approval: Approval) => void;
  patchLifecycle: PatchLifecycle | null;
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
        ä¸Šä¸‹æ–‡å¿«ç…§ç”ŸæˆåŽï¼Œè¿™é‡Œä¼šå±•ç¤ºä¿ç•™æ–‡ä»¶å’ŒæŽ’é™¤åŽŸå› ã€‚
      </div>
    );
  }

  return (
    <div className="split-list" data-testid="context-snapshot">
      <div className="choice">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong>ä¿ç•™ä¸Šä¸‹æ–‡</strong>
          <span className="badge green">{snapshot.selectedFiles.length}</span>
        </div>
        <p>è¯´æ˜Žå½“å‰ä»»åŠ¡ä¸ºä»€ä¹ˆè¯»å–è¿™äº›æ–‡ä»¶ã€‚</p>
        <ul className="list" data-testid="context-selected-list">
          {snapshot.selectedFiles.map((file) => (
            <li key={file.path}>
              <span className="check">âœ“</span>
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
          <strong>æŽ’é™¤è·¯å¾„</strong>
          <span className="badge amber">{snapshot.rejectedFiles.length}</span>
        </div>
        <p>è¯´æ˜Žå“ªäº›è·¯å¾„è¢«æŽ’é™¤ï¼Œä»¥åŠä¸ºä»€ä¹ˆä¸è¿›å…¥æœ¬è½®ä¸Šä¸‹æ–‡ã€‚</p>
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
    return typeof approval.payload.artifactTitle === "string" ? approval.payload.artifactTitle : "åº”ç”¨ patch.diff";
  }

  return typeof approval.payload.command === "string" ? `è¿è¡Œ ${approval.payload.command}` : "è¿è¡Œå—æŽ§å‘½ä»¤";
}

function getApprovalDescription(approval: Approval): string {
  if (approval.kind === "apply_patch") {
    return "å°†å·²ç”Ÿæˆçš„è¡¥ä¸å†™å…¥åˆ°æœ¬åœ°å·¥ä½œåŒºï¼Œå†™å…¥å‰ä¼šè¿›è¡Œè·¯å¾„å’Œ patch æ ¡éªŒã€‚";
  }

  const command = typeof approval.payload.command === "string" ? approval.payload.command : "ç™½åå•å‘½ä»¤";
  return `æ‰¹å‡†åŽ Runner ä¼šåœ¨å·¥ä½œåŒºå†…æ‰§è¡Œ ${command}ï¼Œå¹¶å›žå†™ stdout/stderrã€‚`;
}

function getApprovalRiskTone(approval: Approval): "amber" | "green" {
  return approval.kind === "apply_patch" ? "amber" : "green";
}

function getApprovalRiskLabel(approval: Approval): string {
  return approval.kind === "apply_patch" ? "ä¸­" : "ä½Ž";
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
    return "é«˜";
  }

  if (relevance === "medium") {
    return "ä¸­";
  }

  return "ä½Ž";
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
      return "å·²ç”Ÿæˆ";
    case "precheck_failed":
      return "é¢„æ£€å¤±è´¥";
    case "awaiting_approval":
      return "ç­‰å¾…å®¡æ‰¹";
    case "rejected":
      return "å·²æ‹’ç»";
    case "applied":
      return "å·²åº”ç”¨";
    case "apply_failed":
      return "åº”ç”¨å¤±è´¥";
    default:
      return status;
  }
}

function getPatchPrecheckLabel(status: PatchLifecycle["precheck"]["status"]): string {
  if (status === "passed") {
    return "é€šè¿‡";
  }

  if (status === "failed") {
    return "å¤±è´¥";
  }

  return "å¾…æ‰§è¡Œ";
}

function getPatchApplyLabel(status: PatchLifecycle["applyResult"] extends undefined ? never : NonNullable<PatchLifecycle["applyResult"]>["status"] | undefined): string {
  if (status === "applied") {
    return "å·²åº”ç”¨";
  }

  if (status === "failed") {
    return "å¤±è´¥";
  }

  return "æœªå¼€å§‹";
}

function getPatchLifecycleRiskLabel(lifecycle: PatchLifecycle | null): string {
  if (!lifecycle) {
    return "--";
  }

  if (lifecycle.status === "precheck_failed" || lifecycle.status === "apply_failed") {
    return "é«˜";
  }

  if (lifecycle.status === "applied") {
    return "ä½Ž";
  }

  return "ä¸­";
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

  return "•";
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
  const summary = lines[0] ?? "å®žçŽ°å—æŽ§ç™»å½•é¡µé¢ï¼ŒåŒ…å«é‚®ç®±å’Œå¯†ç è¾“å…¥ã€å®¢æˆ·ç«¯æ ¡éªŒã€æŽ¥å£é”™è¯¯æç¤ºï¼Œä»¥åŠæ— æ•ˆå‡­è¯å›žå½’æµ‹è¯•ã€‚";
  const points = lines.slice(1, 5);

  return (
    <div className="artifact">
      <h4>{artifact.title}</h4>
      <p>{summary}</p>
      <ul className="list">
        {(points.length > 0 ? points : [
          "æ–°å¢žå¯è®¿é—®çš„ç™»å½•è¡¨å•ç»„ä»¶ã€‚",
          "æŽ¥å…¥çŽ°æœ‰è®¤è¯å®¢æˆ·ç«¯ã€‚",
          "è¡¥å……ç©ºå­—æ®µå’Œç™»å½•å¤±è´¥æµ‹è¯•ã€‚",
          "åº”ç”¨è¡¥ä¸åŽè¿è¡Œç±»åž‹æ£€æŸ¥ã€Lint å’Œæµ‹è¯•ã€‚",
        ]).map((point) => (
          <li key={point}><span className="check">âœ“</span>{point.replace(/^\d+\.\s*/, "")}</li>
        ))}
      </ul>
    </div>
  );
}

async function loadDashboardData({
  api,
  setApiOnline,
  setApprovals,
  setAuditEvents,
  setLoadState,
  setSelectedTaskId,
  setTasks,
  setWorkspaces,
}: {
  api: AgentFlowApiClient;
  setApiOnline: (online: boolean) => void;
  setApprovals: (approvals: Approval[]) => void;
  setAuditEvents: (events: AuditEvent[]) => void;
  setLoadState: (state: LoadState) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setTasks: (tasks: Task[]) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
}) {
  setLoadState("loading");

  try {
    const [loadedTasks, loadedWorkspaces, loadedApprovals, loadedAuditEvents] = await Promise.all([
      api.listTasks(),
      api.listWorkspaces(),
      api.listApprovals(),
      api.listAuditEvents(),
    ]);
    setTasks(loadedTasks);
    setWorkspaces(loadedWorkspaces);
    setApprovals(loadedApprovals);
    setAuditEvents(loadedAuditEvents);
    setSelectedTaskId((loadedTasks[0]?.id as string | undefined) ?? null);
    setApiOnline(true);
  } catch {
    setTasks([demoTask]);
    setWorkspaces(demoWorkspaces);
    setApprovals(demoApprovals);
    setAuditEvents(demoAuditEvents);
    setSelectedTaskId(demoTask.id);
    setApiOnline(false);
    setLoadState("error");
    return;
  } finally {
    setLoadState("idle");
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
  setSelectedArtifactId: (artifactId: string | null) => void;
  setTaskSource: (source: TaskSource | null) => void;
  taskId: string;
}) {
  try {
    const [loadedTaskDetails, loadedContextSnapshot, loadedPatchLifecycle, loadedCommandRuns] = await Promise.all([
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
      title: "åˆ›å»ºå¼€å‘ä»»åŠ¡",
      description: "ä»»åŠ¡æ¥æºå¯ä»¥ä¸åŒï¼Œä½†æœ€ç»ˆéƒ½ä¼šè½¬æ¢æˆç»Ÿä¸€çš„ Development Taskã€‚",
    };
  }

  if (taskMode === "detail" && selectedTask) {
    const statusLabel =
      isWaitingForApproval(selectedTask.status)
        ? "ç­‰å¾…å®¡æ‰¹"
        : selectedTask.status === "failed"
          ? "æ‰§è¡Œå¤±è´¥"
          : "è¿è¡Œä¸­";

    return {
      title: selectedTask.title,
      description: `ä»»åŠ¡ ${selectedTask.id.slice(0, 8)} Â· ${statusLabel} Â· å½“å‰é˜¶æ®µï¼š${getTaskStageLabel(selectedTask.stage)}`,
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

function getCurrentBrandCopy(view: ViewKey, taskMode: TaskMode, apiOnline: boolean, workspace: Workspace) {
  if (view === "workspace") {
    return {
      subtitle: "å·¥ä½œåŒºé©±åŠ¨å¼€å‘",
      runnerTitle: "V0 æ¨¡å¼",
      runnerText: apiOnline ? `å½“å‰å·¥ä½œåŒºï¼š${workspace.name}ï¼ŒRunner çŠ¶æ€ ${workspace.status}ã€‚` : "å½“å‰å±•ç¤ºæ¨¡æ‹Ÿè¿žæŽ¥çŠ¶æ€ï¼Œä¸ä¼šè¯»å–æˆ–ä¿®æ”¹æœ¬åœ°æ–‡ä»¶ã€‚",
    };
  }

  if (view === "tasks" && taskMode === "create") {
    return {
      subtitle: "éœ€æ±‚åˆ°å¼€å‘ä»»åŠ¡",
      runnerTitle: "æœ¬åœ° Runner",
      runnerText: apiOnline ? `å·²è¿žæŽ¥åˆ° ${workspace.name}ã€‚` : "API æœªè¿žæŽ¥ï¼Œå½“å‰æ˜¾ç¤ºæœ¬åœ°ç¤ºä¾‹æ•°æ®ã€‚",
    };
  }

  return {
    subtitle: "å¤š Agent å¼€å‘æµç¨‹",
    runnerTitle: "æœ¬åœ° Runner",
    runnerText: apiOnline ? `å·²è¿žæŽ¥åˆ° ${workspace.name}ã€‚` : "API æœªè¿žæŽ¥ï¼Œå½“å‰æ˜¾ç¤ºæœ¬åœ°ç¤ºä¾‹æ•°æ®ã€‚",
  };
}

