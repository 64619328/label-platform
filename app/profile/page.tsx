"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  ensureDemoData,
  getCurrentUserId,
  getTasks,
  getUsers,
  setCurrentRole,
  setCurrentUserId,
  setIdentityConfirmed
} from "@/lib/storage";
import { taskStats } from "@/lib/task-actions";
import type { DemoUser, Task } from "@/lib/types";
import { money } from "@/lib/utils";

export default function ProfilePage() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    ensureDemoData();
    setUsers(getUsers());
    setTasks(getTasks());
    setUserId(getCurrentUserId());
  }, []);

  const current = users.find((user) => user.id === userId);
  const requesterTasks = tasks.filter((task) => task.requesterId === current?.id);
  const annotatorTasks = tasks.filter((task) => task.selectedAnnotatorId === current?.id || task.quotes.some((quote) => quote.annotatorId === current?.id));
  const amount = tasks.reduce((sum, task) => (task.selectedAnnotatorId === current?.id ? sum + taskStats(task).amount : sum), 0);

  function switchUser(nextId: string) {
    const next = users.find((user) => user.id === nextId);
    if (!next) return;
    setCurrentUserId(next.id);
    setCurrentRole(next.role);
    setIdentityConfirmed(true);
    setUserId(next.id);
  }

  function goCurrent() {
    if (!current) return;
    window.location.href = current.role === "requester" ? "/requester/dashboard" : "/annotator/tasks";
  }

  return (
    <main className="shell">
      <AppHeader />
      <div className="page grid">
        <div>
          <span className="side-kicker">Profile Center</span>
          <h1>个人中心</h1>
          <p className="muted">在这里切换 Demo 身份，查看不同身份下的页面和数据。</p>
        </div>

        <section className="grid two">
          <div className="panel grid">
            <h2>当前身份</h2>
            <div className="item">
              <strong>{current?.name ?? "未选择"}</strong>
              <p className="muted">{current?.role === "requester" ? "需求方：发布任务、报价选择、抽检验收" : "标注方：试标报价、正式标注、申诉处理"}</p>
            </div>
            <button className="primary" onClick={goCurrent}>进入当前身份页面</button>
          </div>

          <div className="panel grid">
            <h2>切换身份</h2>
            {users.map((user) => (
              <button key={user.id} className={user.id === userId ? "item active" : "item"} onClick={() => switchUser(user.id)}>
                <div className="row between">
                  <strong>{user.name}</strong>
                  <span className="badge">{user.role === "requester" ? "需求方" : "标注方"}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="stats">
          <div className="stat">
            <span className="muted">发布任务</span>
            <b>{requesterTasks.length}</b>
          </div>
          <div className="stat">
            <span className="muted">参与任务</span>
            <b>{annotatorTasks.length}</b>
          </div>
          <div className="stat">
            <span className="muted">预计结算</span>
            <b>{money(amount)}</b>
          </div>
          <div className="stat">
            <span className="muted">数据源</span>
            <b>localStorage</b>
          </div>
        </section>
      </div>
    </main>
  );
}
