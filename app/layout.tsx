import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "图像标注平台 MVP",
  description: "基于 localStorage 的图像标注服务平台 MVP"
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
