"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ensureDemoData, getUsers, resetWithDemoData, setCurrentRole, setCurrentUserId } from "@/lib/storage";
import type { DemoUser } from "@/lib/types";

export default function HomePage() {
  const [users, setUsers] = useState<DemoUser[]>([]);

  useEffect(() => {
    ensureDemoData();
    setUsers(getUsers());
  }, []);

  function choose(user: DemoUser) {
    setCurrentRole(user.role);
    setCurrentUserId(user.id);
    window.location.href = user.role === "requester" ? "/requester/dashboard" : "/annotator/tasks";
  }

  function reset() {
    resetWithDemoData();
    setUsers(getUsers());
  }

  return (
    <main className="shell">
      <AppHeader />
      <div className="page">
        <section className="hero">
          <div className="panel">
            <h1>图像标注服务平台 MVP</h1>
            <p className="muted">
              在一个浏览器里演示完整标注周期：发布任务、试标报价、正式标注、子任务包提交、抽检验收、申诉、中止和 JSON 下载。
            </p>
            <div className="stats" style={{ marginTop: 20 }}>
              <div className="stat">
                <span className="muted">存储</span>
                <b>localStorage</b>
              </div>
              <div className="stat">
                <span className="muted">角色</span>
                <b>2 类</b>
              </div>
              <div className="stat">
                <span className="muted">Demo 用户</span>
                <b>4 个</b>
              </div>
              <div className="stat">
                <span className="muted">示例任务</span>
                <b>3 个</b>
              </div>
            </div>
            <div className="row" style={{ marginTop: 20 }}>
              <Link href="/requester/dashboard">
                <button className="primary">进入需求方工作台</button>
              </Link>
              <Link href="/annotator/tasks">
                <button>进入标注方任务大厅</button>
              </Link>
              <button onClick={reset}>重置 Demo 数据</button>
            </div>
          </div>
          <div className="panel">
            <h2>选择 Demo 身份</h2>
            <div className="list">
              {users.map((user) => (
                <button key={user.id} onClick={() => choose(user)} className={user.role === "requester" ? "primary" : ""}>
                  {user.name}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
