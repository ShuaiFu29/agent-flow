import type { ReactNode } from "react";
import { Dashboard } from "../../src/components/dashboard";

export default function ConsoleLayout({ children: _children }: { children: ReactNode }) {
  return <Dashboard />;
}
