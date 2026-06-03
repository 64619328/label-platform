import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "图标台 Annota",
  description: "从试标到验收，一台搞定。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
