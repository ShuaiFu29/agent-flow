import type { Workspace } from "@agent-flow/shared";

export function resolveWorkspacePresentation(input: {
  apiOnline: boolean;
  workspaces: Workspace[];
  demoWorkspaces: Workspace[];
}): {
  workspaces: Workspace[];
  showDemoFallback: boolean;
  showEmptyState: boolean;
} {
  if (input.apiOnline) {
    return {
      workspaces: input.workspaces,
      showDemoFallback: false,
      showEmptyState: input.workspaces.length === 0,
    };
  }

  return {
    workspaces: input.workspaces.length > 0 ? input.workspaces : input.demoWorkspaces,
    showDemoFallback: true,
    showEmptyState: false,
  };
}
