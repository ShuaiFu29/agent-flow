import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "agent-flow",
  description: "多 Agent 软件开发协作平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
