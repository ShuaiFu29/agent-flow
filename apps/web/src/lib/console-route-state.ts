export type ConsoleViewKey = "tasks" | "workspace" | "artifacts" | "approvals" | "audit" | "settings";
export type ConsoleTaskMode = "overview" | "detail" | "create";

export type ConsoleRouteState = {
  taskId: string | null;
  taskMode: ConsoleTaskMode;
  view: ConsoleViewKey;
};

export function getConsoleRouteState(pathname: string | null): ConsoleRouteState {
  const normalizedPathname = pathname ?? "/tasks";

  if (normalizedPathname === "/tasks/new") {
    return { taskId: null, taskMode: "create", view: "tasks" };
  }

  const taskDetailMatch = normalizedPathname.match(/^\/tasks\/([^/]+)$/);
  const matchedTaskId = taskDetailMatch?.[1];
  if (matchedTaskId) {
    return { taskId: decodeURIComponent(matchedTaskId), taskMode: "detail", view: "tasks" };
  }

  if (normalizedPathname.startsWith("/workspaces")) {
    return { taskId: null, taskMode: "overview", view: "workspace" };
  }

  if (normalizedPathname.startsWith("/artifacts")) {
    return { taskId: null, taskMode: "overview", view: "artifacts" };
  }

  if (normalizedPathname.startsWith("/approvals")) {
    return { taskId: null, taskMode: "overview", view: "approvals" };
  }

  if (normalizedPathname.startsWith("/audit")) {
    return { taskId: null, taskMode: "overview", view: "audit" };
  }

  if (normalizedPathname.startsWith("/settings")) {
    return { taskId: null, taskMode: "overview", view: "settings" };
  }

  return { taskId: null, taskMode: "overview", view: "tasks" };
}
